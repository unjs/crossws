// https://bun.sh/docs/api/websockets

import type { WebSocketHandler, ServerWebSocket, Server } from "bun";
import { Message } from "../message";
import { Peer } from "../peer";
import { AdapterOptions, defineWebSocketAdapter } from "../types";
import { createCrossWS } from "../crossws";
import { toBufferLike } from "../_utils";

export interface BunAdapter {
  websocket: WebSocketHandler<ContextData>;
  handleUpgrade(req: Request, server: Server): Promise<boolean>;
}

export interface BunOptions extends AdapterOptions {}

type ContextData = {
  _peer?: Peer;
  req?: Request;
  server?: Server;
};

export default defineWebSocketAdapter<BunAdapter, BunOptions>(
  (options = {}) => {
    const crossws = createCrossWS(options);

    const getPeer = (ws: ServerWebSocket<ContextData>) => {
      if (ws.data?._peer) {
        return ws.data._peer;
      }
      const peer = new BunPeer({ bun: { ws } });
      ws.data = ws.data || {};
      ws.data._peer = peer;
      return peer;
    };

    return {
      async handleUpgrade(req: Request, server: Server) {
        const { headers } = await crossws.upgrade({
          url: req.url,
          headers: req.headers,
        });
        return server.upgrade(req, {
          data: { req, server },
          headers,
        });
      },
      websocket: {
        message: (ws, message) => {
          const peer = getPeer(ws);
          crossws.$callHook("bun:message", peer, ws, message);
          crossws.callHook("message", peer, new Message(message));
        },
        open: (ws) => {
          const peer = getPeer(ws);
          crossws.$callHook("bun:open", peer, ws);
          crossws.callHook("open", peer);
        },
        close: (ws) => {
          const peer = getPeer(ws);
          crossws.$callHook("bun:close", peer, ws);
          crossws.callHook("close", peer, {});
        },
        drain: (ws) => {
          const peer = getPeer(ws);
          crossws.$callHook("bun:drain", peer);
        },
        ping(ws, data) {
          const peer = getPeer(ws);
          crossws.$callHook("bun:ping", peer, ws, data);
        },
        pong(ws, data) {
          const peer = getPeer(ws);
          crossws.$callHook("bun:pong", peer, ws, data);
        },
      },
    };
  },
);

class BunPeer extends Peer<{
  bun: { ws: ServerWebSocket<ContextData> };
}> {
  get id() {
    let addr = this.ctx.bun.ws.remoteAddress;
    if (addr.includes(":")) {
      addr = `[${addr}]`;
    }
    return addr;
  }

  get readyState() {
    return this.ctx.bun.ws.readyState as any;
  }

  get url() {
    return this.ctx.bun.ws.data.req?.url || "/";
  }

  get headers() {
    return this.ctx.bun.ws.data.req?.headers || new Headers();
  }

  send(message: any, options?: { compress?: boolean }) {
    return this.ctx.bun.ws.send(toBufferLike(message), options?.compress);
  }

  publish(topic: string, message: any, options?: { compress?: boolean }) {
    return this.ctx.bun.ws.publish(
      topic,
      toBufferLike(message),
      options?.compress,
    );
  }

  subscribe(topic: string): void {
    this.ctx.bun.ws.subscribe(topic);
  }

  unsubscribe(topic: string): void {
    this.ctx.bun.ws.unsubscribe(topic);
  }
}
