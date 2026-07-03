import type { Server } from "srvx";

import type { Hooks } from "../hooks";
import type { WSOptions } from "./_types";

const HOOK_NAMES = ["upgrade", "message", "open", "close", "drain", "error"] as const;

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

  return (req) => Promise.resolve(fetch(req)).then((res) => hooksFromFetchResult(res));
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
function hooksFromFetchResult(res: unknown): Partial<Hooks> {
  const crossws = (res as { crossws?: Partial<Hooks> } | undefined)?.crossws;

  if (res instanceof Response) {
    // Only `.crossws` is consumed; release the rest of the response so a
    // streaming/proxied body on the upgrade path isn't leaked per connection.
    res.body?.cancel().catch(() => {});
    return crossws as Partial<Hooks>;
  }

  const headers = (res as { headers?: HeadersInit } | undefined)?.headers;
  if (!headers) {
    return crossws as Partial<Hooks>;
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
