// https://bun.sh/docs/api/websockets

import type { WebSocketHandler, ServerWebSocket, Server } from "bun";
import { Message } from "../message";
import { Peer } from "../peer";
import { AdapterOptions, defineWebSocketAdapter } from "../types";
import { CrossWS } from "../crossws";
import { toBufferLike } from "../_utils";

export interface BunAdapter {
  websocket: WebSocketHandler<ContextData>;
  handleUpgrade(req: Request, server: Server): Promise<Response | undefined>;
}

export interface BunOptions extends AdapterOptions {}

type ContextData = {
  _peer?: Peer;
  request?: Request;
  requestUrl?: string;
  server?: Server;
};

export default defineWebSocketAdapter<BunAdapter, BunOptions>(
  (options = {}) => {
    const crossws = new CrossWS(options);
    return {
      async handleUpgrade(request, server) {
        const res = await crossws.callHook("upgrade", request);
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
        return upgradeOK
          ? undefined
          : new Response("Upgrade failed", { status: 500 });
      },
      websocket: {
        message: (ws, message) => {
          const peer = getPeer(ws);
          crossws.callAdapterHook("bun:message", peer, ws, message);
          crossws.callHook("message", peer, new Message(message));
        },
        open: (ws) => {
          const peer = getPeer(ws);
          crossws.callAdapterHook("bun:open", peer, ws);
          crossws.callHook("open", peer);
        },
        close: (ws) => {
          const peer = getPeer(ws);
          crossws.callAdapterHook("bun:close", peer, ws);
          crossws.callHook("close", peer, {});
        },
        drain: (ws) => {
          const peer = getPeer(ws);
          crossws.callAdapterHook("bun:drain", peer);
        },
        ping(ws, data) {
          const peer = getPeer(ws);
          crossws.callAdapterHook("bun:ping", peer, ws, data);
        },
        pong(ws, data) {
          const peer = getPeer(ws);
          crossws.callAdapterHook("bun:pong", peer, ws, data);
        },
      },
    };
  },
);

function getPeer(ws: ServerWebSocket<ContextData>) {
  if (ws.data?._peer) {
    return ws.data._peer;
  }
  const peer = new BunPeer({ bun: { ws } });
  ws.data = {
    ...ws.data,
    _peer: peer,
  };
  return peer;
}

class BunPeer extends Peer<{
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
