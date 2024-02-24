// https://bun.sh/docs/api/websockets

import type { WebSocketHandler, ServerWebSocket, Server } from "bun";

import { WebSocketMessage } from "../message";
import { WebSocketError } from "../error";
import { WSPeer } from "../peer";
import { defineWebSocketAdapter } from "../adapter";
import { CrossWSOptions, createCrossWS } from "../crossws";

export interface AdapterOptions extends CrossWSOptions {}

type ContextData = {
  _peer?: WSPeer;
  req?: Request;
  server?: Server;
};

export interface Adapter {
  websocket: WebSocketHandler<ContextData>;
  handleUpgrade(req: Request, server: Server): Promise<boolean>;
}

export default defineWebSocketAdapter<Adapter, AdapterOptions>(
  (hooks, options = {}) => {
    const crossws = createCrossWS(hooks, options);

    const getWSPeer = (ws: ServerWebSocket<ContextData>) => {
      if (ws.data?._peer) {
        return ws.data._peer;
      }
      const peer = new BunWSPeer({ bun: { ws } });
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
          const peer = getWSPeer(ws);
          crossws.$("bun:message", peer, ws, message);
          crossws.message(peer, new WebSocketMessage(message));
        },
        open: (ws) => {
          const peer = getWSPeer(ws);
          crossws.$("bun:open", peer, ws);
          crossws.open(peer);
        },
        close: (ws) => {
          const peer = getWSPeer(ws);
          crossws.$("bun:close", peer, ws);
          crossws.close(peer, {});
        },
        drain: (ws) => {
          const peer = getWSPeer(ws);
          crossws.$("bun:drain", peer);
        },
        ping(ws, data) {
          const peer = getWSPeer(ws);
          crossws.$("bun:ping", peer, ws, data);
        },
        pong(ws, data) {
          const peer = getWSPeer(ws);
          crossws.$("bun:pong", peer, ws, data);
        },
      },
    };
  },
);

class BunWSPeer extends WSPeer<{
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

  send(message: string | ArrayBuffer) {
    this.ctx.bun.ws.send(message);
    return 0;
  }
}
