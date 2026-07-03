import type { Server } from "srvx";

import type { Hooks } from "../hooks";
import type { WSOptions } from "./_types";

const HOOK_NAMES: (keyof Hooks)[] = ["upgrade", "message", "open", "close", "drain", "error"];

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
    Promise.resolve(fetch(req)).then(
      (res) => (res as { crossws?: Partial<Hooks> }).crossws as Partial<Hooks>,
    );
}
