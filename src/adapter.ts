import type { Hooks, MaybePromise, ResolveHooks } from "./hooks.ts";
import type { Peer } from "./peer.ts";
import type { SyncAdapter, SyncDriver, SyncMessage } from "./sync.ts";
import { serializeMessage } from "./utils.ts";

export function adapterUtils(
  globalPeers: Map<string, Set<Peer>>,
  options?: AdapterOptions,
  caps?: { nativePubSub?: boolean },
): AdapterInstance {
  // Relay-free local fan-out: deliver `message` to every local subscriber of
  // `topic`. Reused both for the public `publish` and for delivering messages
  // relayed from other instances (the latter must NOT echo back to the sync
  // backplane, hence `_publish` rather than the relay-aware `publish`).
  //
  // Native pub/sub adapters (bun, uWebSockets) broadcast a topic app-wide with
  // a single `ws.publish(topic)` that ignores namespaces. For a global publish
  // (no `namespace`) we therefore stop after the first namespace with a match:
  // a second `_publish` would re-broadcast app-wide and deliver every message
  // again. Loop-based adapters fan out within a single namespace Set, so they
  // must visit every namespace.
  //
  // Caveat: because native `ws.publish` is app-wide, a *namespaced* publish on a
  // native adapter still reaches same-topic subscribers in other namespaces —
  // namespace isolation is best-effort there (true on the local path and, via
  // the sync relay, cross-instance too). Loop-based adapters honor namespaces.
  const localPublish = (
    topic: string,
    message: any,
    pubOptions?: { compress?: boolean; namespace?: string },
  ) => {
    for (const peers of pubOptions?.namespace
      ? [globalPeers.get(pubOptions.namespace) || []]
      : globalPeers.values()) {
      let firstPeerWithTopic: Peer | undefined;
      for (const peer of peers) {
        if (peer.topics.has(topic)) {
          firstPeerWithTopic = peer;
          break;
        }
      }
      if (firstPeerWithTopic) {
        firstPeerWithTopic.send(message, pubOptions);
        firstPeerWithTopic._publish(topic, message, pubOptions);
        if (caps?.nativePubSub && !pubOptions?.namespace) {
          // `_publish` already reached every subscriber app-wide.
          break;
        }
      }
    }
  };

  let sync: SyncDriver | undefined;
  if (options?.sync) {
    // Every sync operation is fire-and-forget (a flaky backplane must never
    // crash the app or surface as an unhandled rejection), so this reporter is
    // the only window into a degraded backplane. Route every failure through
    // the user's `onError`, falling back to `console.error`.
    const report = (stage: SyncErrorContext["stage"], error: unknown) => {
      if (options.onError) {
        options.onError(error, { stage });
      } else {
        console.error(`[crossws] sync ${stage} failed:`, error);
      }
    };
    const driver = options.sync({ id: crypto.randomUUID() });
    const deliver = (msg: SyncMessage) => {
      // A failing subscriber send must not break the relay nor bubble into the
      // driver's transport callback (e.g. a Redis "message" handler); isolate
      // per-delivery errors here.
      try {
        // `""` namespace means "all namespaces" (server-side global publish).
        localPublish(msg.topic, msg.data, { namespace: msg.namespace || undefined });
      } catch (error) {
        report("delivery", error);
      }
    };
    // Setup must never crash adapter construction: catch a synchronous throw
    // (e.g. a driver that opens a connection eagerly in a restricted scope like
    // workerd module-init) as well as an async subscribe rejection.
    try {
      Promise.resolve(driver.subscribe(deliver)).catch((error) => report("subscribe", error));
    } catch (error) {
      report("subscribe", error);
    }
    // Wrap the driver so the relay callers below (and `Peer.publish`, which
    // shares this same instance via `_internal.sync`) can fire-and-forget
    // without each re-implementing rejection isolation: a publish rejection
    // (e.g. a dropped backplane connection) is caught here and reported.
    sync = {
      subscribe: (deliver) => driver.subscribe(deliver),
      // Guard a synchronous throw as well as an async rejection: this is called
      // fire-and-forget from `Peer.publish` / `adapter.publish`, so a sync throw
      // would otherwise escape into the caller's `publish()` and defeat the
      // isolation. Both paths route to `onError`.
      publish: (msg) => {
        try {
          return Promise.resolve(driver.publish(msg)).catch((e) => report("publish", e));
        } catch (error) {
          report("publish", error);
        }
      },
      close: driver.close ? () => driver.close!() : undefined,
    };
  }

  return {
    peers: globalPeers,
    sync,
    publish(topic: string, message: any, options) {
      localPublish(topic, message, options);
      // Fire-and-forget relay; `sync.publish` isolates its own rejections.
      sync?.publish({
        namespace: options?.namespace || "",
        topic,
        data: serializeMessage(message),
      });
    },
    async close(code, reason) {
      // Gracefully close every connected peer via the adapter-specific
      // `Peer.close`, then tear down the sync backplane. Peers are removed from
      // `globalPeers` by their async close handlers (after the socket actually
      // closes), so iterating the live Sets here is safe.
      for (const peers of globalPeers.values()) {
        for (const peer of peers) {
          peer.close(code, reason);
        }
      }
      await sync?.close?.();
    },
  } satisfies AdapterInstance;
}

export function getPeers<T extends Peer = Peer>(
  globalPeers: Map<string, Set<T>>,
  namespace: string,
): Set<T> {
  if (!namespace) {
    throw new Error("Websocket publish namespace missing.");
  }
  let peers = globalPeers.get(namespace);
  if (!peers) {
    peers = new Set<T>();
    globalPeers.set(namespace, peers);
  }
  return peers;
}

// --- types ---

export interface AdapterInstance {
  readonly peers: Map<string, Set<Peer>>;
  readonly publish: (
    topic: string,
    data: unknown,
    options?: { compress?: boolean; namespace?: string },
  ) => void;
  /**
   * Gracefully shut the adapter down: close every connected peer (with the
   * optional `code` / `reason`) and tear down the {@link AdapterInstance.sync}
   * backplane. Any underlying server you created (e.g. an `http.Server` or a
   * `WebSocketServer` passed via options) stays yours to close.
   */
  readonly close: (code?: number, reason?: string) => Promise<void>;
  /**
   * Sync backplane driver, present when an adapter is created with `sync`.
   *
   * Closed automatically by {@link AdapterInstance.close}; it leaves any
   * user-owned client (Redis/Postgres) connected.
   */
  readonly sync?: SyncDriver;
}

/** Context passed to {@link AdapterOptions.onError} describing what failed. */
export interface SyncErrorContext {
  /**
   * Which backplane operation failed:
   * - `subscribe` — the initial subscription to the backplane.
   * - `publish` — relaying a local publish out to the other instances.
   * - `delivery` — fanning an inbound remote message out to local subscribers.
   */
  stage: "subscribe" | "publish" | "delivery";
}

export interface AdapterOptions {
  resolve?: ResolveHooks;
  getNamespace?: (request: Request) => string;
  hooks?: Partial<Hooks>;

  /**
   * Select the WebSocket subprotocol to accept during the handshake.
   *
   * Browsers that open `new WebSocket(url, protocols)` send their offer in the
   * `Sec-WebSocket-Protocol` request header and **reject the connection** if
   * the server's `101` response doesn't echo one of the offered values back.
   * By default crossws negotiates nothing (a server never claims to speak a
   * protocol the app didn't opt into), so supply this to accept one.
   *
   * Called with the set of subprotocols the client offered and the upgrade
   * request. Return the single subprotocol to accept (must be one of the
   * offered values), or `false`/`undefined` to accept none. Only invoked when
   * the client actually offered at least one subprotocol.
   *
   * This is the global default; the {@link Hooks.upgrade} hook may return
   * `{ protocol }` to override it per connection.
   *
   * @example
   * handleProtocols: (protocols) =>
   *   protocols.has("graphql-transport-ws") ? "graphql-transport-ws" : false
   */
  handleProtocols?: (
    protocols: Set<string>,
    request: Request,
  ) => MaybePromise<string | false | null | undefined>;
  /**
   * Optional sync backplane to relay pub/sub between multiple crossws
   * instances (e.g. across regions/processes). Opt-in: when absent, pub/sub
   * stays local to the instance, exactly as before.
   */
  sync?: SyncAdapter;
  /**
   * Called when a {@link AdapterOptions.sync} backplane operation fails.
   *
   * Relay is fire-and-forget by design — a flaky backplane never throws into
   * your `publish` call or crashes the process — so this callback is the only
   * way to observe a degraded backplane (for logging, metrics or alerting).
   * Defaults to `console.error`. Has no effect without `sync`.
   */
  onError?: (error: unknown, context: SyncErrorContext) => void;

  /**
   * Close a connection that has stayed idle — no incoming messages and no
   * pong replies — for roughly this many **seconds**. This reclaims peers
   * whose transport died silently ("half-open" sockets: laptop sleep,
   * NAT/mobile idle timeout, power loss, a cut cable) without the TCP stack
   * ever delivering a `FIN`/`RST`, which would otherwise leak forever.
   *
   * Implemented per runtime, but with a single consistent knob:
   * - **Node** — the `ws` library has no built-in liveness, so crossws pings
   *   each peer on this interval and terminates any that miss the pong. Honors
   *   sub-second (fractional) values.
   * - **Bun / Deno / uWebSockets / Bunny** — mapped to the runtime's native
   *   WebSocket idle timeout, which also auto-sends keepalive pings. These
   *   runtimes take **whole seconds**, so a fractional value is rounded down —
   *   a value below `1` may become `0` and disable liveness there; use `>= 1`.
   *
   * Terminated peers surface through the normal `close` hook (Node reports
   * code `1006`), so any `close`/`error` teardown — including
   * `createWebSocketProxy` closing its upstream — runs unchanged.
   *
   * Set to `0` to disable. Defaults to {@link DEFAULT_IDLE_TIMEOUT} (30s) on
   * every runtime — low enough to keep idle connections alive through the
   * typical ~60s reverse-proxy / load-balancer idle timeout, while reclaiming
   * dead sockets promptly. Pings are a few bytes and standards clients auto-pong,
   * so a live connection is never disconnected.
   *
   * @default 30 (seconds)
   */
  idleTimeout?: number;
}

/**
 * Default {@link AdapterOptions.idleTimeout} (seconds), applied consistently by
 * every adapter. 30s stays under the common ~60s intermediary (reverse-proxy /
 * load-balancer) idle timeout while still reclaiming dead sockets promptly, and
 * sits within Socket.IO's keepalive range.
 */
export const DEFAULT_IDLE_TIMEOUT = 30;

export type Adapter<
  AdapterT extends AdapterInstance = AdapterInstance,
  Options extends AdapterOptions = AdapterOptions,
> = (options?: Options) => AdapterT;

export function defineWebSocketAdapter<
  AdapterT extends AdapterInstance = AdapterInstance,
  Options extends AdapterOptions = AdapterOptions,
>(factory: Adapter<AdapterT, Options>): Adapter<AdapterT, Options> {
  return factory;
}
