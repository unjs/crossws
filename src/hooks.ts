import type { AdapterOptions } from "./adapter.ts";
import type { WSError } from "./error.ts";
import type { Peer, PeerContext } from "./peer.ts";
import type { Message } from "./message.ts";

export class AdapterHookable {
  options: AdapterOptions;

  // Memoized `resolve` result per connection. `resolve` may be expensive — the
  // default `crossws/server` resolver invokes the app's `fetch` handler — so it
  // must run **exactly once per connection**, not on every `callHook` (i.e. not
  // on every message). The cache is keyed by the connection's `context` object,
  // which `upgrade()` creates and every adapter re-exposes verbatim as
  // `peer.context`. That single shared identity spans both the `upgrade` event
  // and every later peer event, so one `resolve` call serves the whole
  // connection. Keyed weakly so entries are released when the connection is
  // garbage collected.
  #resolveCache = new WeakMap<object, MaybePromise<Partial<Hooks> | undefined>>();

  constructor(options?: AdapterOptions) {
    this.options = options || {};
  }

  callHook<N extends keyof Hooks>(
    name: N,
    arg1: Parameters<Hooks[N]>[0],
    arg2?: Parameters<Hooks[N]>[1],
    // The connection's `context` object, used as the per-connection cache key.
    // Passed explicitly by `upgrade()` (no peer exists yet); for peer events it
    // is derived from `peer.context`, which is the same object.
    connection?: object,
  ): MaybePromise<ReturnType<Hooks[N]>> {
    // Call global hook first
    const globalHook = this.options.hooks?.[name];
    const globalPromise = globalHook?.(arg1 as any, arg2 as any);

    const resolve = this.options.resolve;
    if (!resolve) {
      return globalPromise as any; // Fast path: no resolver configured
    }

    // Resolve hooks for the connection, memoized by the shared `context`
    // identity so `resolve` runs once per connection instead of per event.
    const request = (arg1 as Peer).request || arg1;
    const cacheKey = connection || (arg1 as Peer).context || request;
    let resolveHooksPromise: MaybePromise<Partial<Hooks> | undefined>;
    if (this.#resolveCache.has(cacheKey)) {
      resolveHooksPromise = this.#resolveCache.get(cacheKey);
    } else {
      resolveHooksPromise = resolve(request);
      this.#resolveCache.set(cacheKey, resolveHooksPromise);
    }
    if (!resolveHooksPromise) {
      return globalPromise as any; // Fast path: no hooks to resolve
    }
    const resolvePromise =
      resolveHooksPromise instanceof Promise
        ? resolveHooksPromise.then((hooks) => hooks?.[name])
        : resolveHooksPromise?.[name];

    // In parallel, call global hook and resolve hook implementation
    return Promise.all([globalPromise, resolvePromise]).then(([globalRes, hook]) => {
      const hookResPromise = hook?.(arg1 as any, arg2 as any);
      return hookResPromise instanceof Promise
        ? hookResPromise.then((hookRes) => hookRes || globalRes)
        : hookResPromise || globalRes;
    }) as Promise<any>;
  }

  async upgrade(request: Request & { readonly context?: Record<string, unknown> }): Promise<{
    context: PeerContext;
    namespace: string;
    upgradeHeaders?: HeadersInit;
    endResponse?: Response;
    handled?: boolean;
  }> {
    let namespace = this.options.getNamespace?.(request) ?? new URL(request.url).pathname;

    const context = request.context || {};

    try {
      // Seed the per-connection resolve cache against `context` so every later
      // peer event on this connection reuses this single `resolve` call.
      const res = await this.callHook(
        "upgrade",
        request as Request & { context?: PeerContext },
        undefined,
        context,
      );
      if (!res) {
        return { context, namespace };
      }
      if ((res as { namespace?: string }).namespace) {
        namespace = (res as { namespace: string }).namespace;
      }
      if ((res as { context?: Record<string, unknown> }).context) {
        Object.assign(context, (res as { context?: Record<string, unknown> }).context);
      }
      if (res instanceof Response) {
        return { context, namespace, endResponse: res };
      }
      if ((res as { handled?: boolean }).handled) {
        // Hook took ownership of the socket — any `headers` returned
        // alongside `handled` are ignored since the adapter skips its
        // own upgrade and no response will be written from here.
        return { context, namespace, handled: true };
      }
      if (res.headers) {
        return {
          context,
          namespace,
          upgradeHeaders: res.headers,
        };
      }
    } catch (error) {
      const errResponse = (error as { response: Response }).response || error;
      if (errResponse instanceof Response) {
        return {
          context,
          namespace,
          endResponse: errResponse,
        };
      }
      throw error;
    }
    return { context, namespace };
  }
}

// --- types ---

export function defineHooks<T extends Partial<Hooks> = Partial<Hooks>>(hooks: T): T {
  return hooks;
}

export type ResolveHooks = (
  request: Request & { readonly context?: PeerContext },
) => Partial<Hooks> | Promise<Partial<Hooks>>;

export type MaybePromise<T> = T | Promise<T>;

export type UpgradeError = Response | { readonly response: Response };

export interface Hooks {
  /**
   * Upgrading a request to a WebSocket connection.
   *
   * - You can throw a Response to abort the upgrade.
   * - You can return { headers } to modify the response.
   * - You can return { namespace } to change the pub/sub namespace.
   * - You can return { context } to provide a custom peer context.
   * - You can return { handled: true } to signal that the upgrade has
   *   already been performed by the hook (e.g. delegated to an external
   *   node-style `(req, socket, head)` handler). The adapter will then
   *   leave the socket alone and skip its own upgrade.
   *
   * @param request
   * @throws {Response}
   */
  upgrade: (
    request: Request & {
      readonly context?: Record<string, unknown>;
    },
  ) => MaybePromise<
    | {
        headers?: HeadersInit;
        namespace?: string;
        context?: PeerContext;
        handled?: boolean;
      }
    | Response
    | void
  >;

  /** A message is received */
  message: (peer: Peer, message: Message) => MaybePromise<void>;

  /** A socket is opened */
  open: (peer: Peer) => MaybePromise<void>;

  /** A socket is closed */
  close: (peer: Peer, details: { code?: number; reason?: string }) => MaybePromise<void>;

  /**
   * The send buffer has drained after backpressure, so it is safe to resume
   * sending. Pair with {@link Peer.bufferedAmount} to throttle senders.
   *
   * **Note:** Only emitted by adapters that expose a drain signal. Refer to the
   * [compatibility table](https://crossws.h3.dev/guide/peer#compatibility).
   */
  drain: (peer: Peer) => MaybePromise<void>;

  /** An error occurs */
  error: (peer: Peer, error: WSError) => MaybePromise<void>;
}
