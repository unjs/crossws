import type { WebSocketHandler, ServerWebSocket, Server } from "bun";

import type { AdapterOptions, AdapterInstance } from "../adapter.ts";
import { toBufferLike } from "../utils.ts";
import { defineWebSocketAdapter, adapterUtils } from "../adapter.ts";
import { AdapterHookable } from "../hooks.ts";
import { Message } from "../message.ts";
import { Peer } from "../peer.ts";

// --- types ---

export interface BunAdapter extends AdapterInstance {
  websocket: WebSocketHandler<ContextData>;
  handleUpgrade(req: Request, server: Server): Promise<Response | undefined>;
}

export interface BunOptions extends AdapterOptions {}

type ContextData = {
  _peer?: BunPeer;
  request?: Request;
  requestUrl?: string;
  server?: Server;
};

// --- adapter ---

// https://bun.sh/docs/api/websockets
export default defineWebSocketAdapter<BunAdapter, BunOptions>(
  (options = {}) => {
    const hooks = new AdapterHookable(options);
    const peers = new Set<BunPeer>();
    return {
      ...adapterUtils(peers),
      async handleUpgrade(request, server) {
        const res = await hooks.callHook("upgrade", request);
        if (res instanceof Response) {
          return res;
        }
        const upgradeOK = server.upgrade(request, {
          data: {
            server,
            request,
            requestUrl: request.url,
          } satisfies ContextData,
          headers: res?.headers,
        });
        if (!upgradeOK) {
          return new Response("Upgrade failed", { status: 500 });
        }
      },
      websocket: {
        message: (ws, message) => {
          const peer = getPeer(ws, peers);
          hooks.callHook("message", peer, new Message(message));
        },
        open: (ws) => {
          const peer = getPeer(ws, peers);
          peers.add(peer);
          hooks.callAdapterHook("bun:open", peer, ws);
          hooks.callHook("open", peer);
        },
        close: (ws) => {
          const peer = getPeer(ws, peers);
          peers.delete(peer);
          hooks.callAdapterHook("bun:close", peer, ws);
          hooks.callHook("close", peer, {});
        },
        drain: (ws) => {
          const peer = getPeer(ws, peers);
          hooks.callAdapterHook("bun:drain", peer);
        },
        ping(ws, data) {
          const peer = getPeer(ws, peers);
          hooks.callAdapterHook("bun:ping", peer, ws, data);
        },
        pong(ws, data) {
          const peer = getPeer(ws, peers);
          hooks.callAdapterHook("bun:pong", peer, ws, data);
        },
      },
    };
  },
);

// --- peer ---

function getPeer(
  ws: ServerWebSocket<ContextData>,
  peers: Set<BunPeer>,
): BunPeer {
  if (ws.data?._peer) {
    return ws.data._peer;
  }
  const peer = new BunPeer({ peers, bun: { ws } });
  ws.data = {
    ...ws.data,
    _peer: peer,
  };
  return peer;
}

class BunPeer extends Peer<{
  peers: Set<BunPeer>;
  bun: { ws: ServerWebSocket<ContextData> };
}> {
  get addr() {
    let addr = this._internal.bun.ws.remoteAddress;
    if (addr.includes(":")) {
      addr = `[${addr}]`;
    }
    return addr;
  }

  get readyState() {
    return this._internal.bun.ws.readyState as any;
  }

  get url() {
    return this._internal.bun.ws.data.requestUrl || "/";
  }

  get headers() {
    return this._internal.bun.ws.data.request?.headers;
  }

  send(message: any, options?: { compress?: boolean }) {
    return this._internal.bun.ws.send(toBufferLike(message), options?.compress);
  }

  publish(topic: string, message: any, options?: { compress?: boolean }) {
    return this._internal.bun.ws.publish(
      topic,
      toBufferLike(message),
      options?.compress,
    );
  }

  subscribe(topic: string): void {
    this._internal.bun.ws.subscribe(topic);
  }

  unsubscribe(topic: string): void {
    this._internal.bun.ws.unsubscribe(topic);
  }

  close(code?: number, reason?: string) {
    this._internal.bun.ws.close(code, reason);
  }

  terminate() {
    this._internal.bun.ws.terminate();
  }
}
