import type { Server } from "srvx";

import type { Hooks } from "../hooks";
import type { WSOptions } from "./_types";

const HOOK_NAMES = [
  "upgrade",
  "message",
  "open",
  "close",
  "drain",
  "error",
  "ping",
  "pong",
] as const;

// Compile-time guard: if a hook is added to `Hooks` but not listed above, the
// leftover key is no longer `never`, so this type resolves to a tuple and the
// `satisfies true` below errors — preventing the inline-hook detection in
// `defaultResolve` from silently missing the new hook.
type _AllHookNamesListed = [Exclude<keyof Hooks, (typeof HOOK_NAMES)[number]>] extends [never]
  ? true
  : ["HOOK_NAMES is missing hook(s):", Exclude<keyof Hooks, (typeof HOOK_NAMES)[number]>];
true satisfies _AllHookNamesListed;

/**
 * Resolve the hooks resolver for a server plugin.
 *
 * - When the user provides an explicit `resolve`, it is returned unchanged.
 * - When the user passes inline hook functions (e.g. `ws({ message })`) and no
 *   `resolve`, `undefined` is returned so those hooks run via the adapter's
 *   global-hook path with zero per-event overhead. Inline hooks and
 *   app-resolved hooks are treated as mutually exclusive modes.
 * - Otherwise a default resolver is returned that calls the server's own
 *   `fetch` handler and reads the `crossws` property off the returned
 *   `Response` (the srvx convention for attaching WebSocket hooks).
 *
 * @throws if the server has no `fetch` handler to resolve hooks from.
 */
export function defaultResolve(server: Server, wsOpts: WSOptions): WSOptions["resolve"] {
  if (wsOpts.resolve) {
    return wsOpts.resolve;
  }

  // Inline hooks are handled by the adapter's global-hook path; adding the
  // default resolver would only cost an extra fetch per hook event.
  if (HOOK_NAMES.some((name) => typeof wsOpts[name] === "function")) {
    return undefined;
  }

  const fetch = server.options.fetch;
  if (typeof fetch !== "function") {
    throw new Error("[crossws] server has no fetch handler to resolve WebSocket hooks from");
  }

  return (req) =>
    Promise.resolve(fetch(req)).then((res) => hooksFromFetchResult(res) as Partial<Hooks>);
}

/**
 * Extract WebSocket hooks from a `fetch` result for the default resolver.
 *
 * The result may be either:
 * - a `Response` carrying hooks on its `crossws` property — only `.crossws` is
 *   read, the body is released, and the response's HTTP headers are ignored
 *   (they are not handshake headers); or
 * - a plain `{ crossws, headers }` object, where `headers` are applied to the
 *   WebSocket handshake response.
 */
function hooksFromFetchResult(res: unknown): Partial<Hooks> | undefined {
  const crossws = (res as { crossws?: Partial<Hooks> } | undefined)?.crossws;

  if (res instanceof Response) {
    if (crossws) {
      // Hooks attached — upgrade with them; the response body is unused, so
      // release it (avoids leaking a streaming/proxied body per connection).
      res.body?.cancel().catch(() => {});
      return crossws;
    }
    // No hooks attached. Render an error/redirect response (send it to the
    // client and fail the handshake) instead of silently upgrading a
    // handler-less socket — e.g. an app returning
    // `new Response("Unauthorized", { status: 401 })` on the upgrade path.
    // `101` (Switching Protocols, as produced by e.g. Cloudflare's
    // `WebSocketPair`) signals an upgrade, so it is not treated as an error.
    if (!res.ok && res.status !== 101) {
      return { upgrade: () => res };
    }
    // A `2xx`/`101` response without hooks: proceed with the upgrade but attach
    // no hooks; the response body is unused, so release it.
    res.body?.cancel().catch(() => {});
    return undefined;
  }

  const headers = (res as { headers?: HeadersInit } | undefined)?.headers;
  if (!headers) {
    return crossws;
  }

  // Apply the shortcut `headers` to the handshake by composing an `upgrade`
  // hook, merged with (and overridden by) any `upgrade` hook from `.crossws`.
  const userUpgrade = crossws?.upgrade;
  return {
    ...crossws,
    async upgrade(request) {
      const result = await userUpgrade?.(request);
      if (result instanceof Response) {
        return result;
      }
      return { ...result, headers: mergeHeaders(headers, result?.headers) };
    },
  };
}

function mergeHeaders(base: HeadersInit, extra?: HeadersInit): HeadersInit {
  if (!extra) {
    return base;
  }
  const merged = new Headers(base);
  for (const [key, value] of new Headers(extra)) {
    merged.set(key, value);
  }
  return merged;
}
