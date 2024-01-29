// https://bun.sh/docs/api/websockets

// @ts-expect-error
import type {} from "bun-types";

import { WebSocketMessage } from "../message";
import { WebSocketError } from "../error";
import { WebSocketPeerBase } from "../peer";
import { defineWebSocketAdapter } from "../adapter";

export interface AdapterOptions {}

type ContextData = { _peer?: WebSocketPeer };

type WebSocketHooks = Extract<
  Parameters<typeof Bun.serve<ContextData>>[0],
  { websocket: any }
>["websocket"];

type ServerWebSocket = Parameters<WebSocketHooks["message"]>[0];

export interface Adapter {
  websocket: WebSocketHooks;
}

export default defineWebSocketAdapter<Adapter, AdapterOptions>(
  (hooks, opts = {}) => {
    const getPeer = (ws: ServerWebSocket) => {
      if (ws.data?._peer) {
        return ws.data._peer;
      }
      const peer = new WebSocketPeer({ bun: { ws } });
      ws.data = ws.data || {};
      ws.data._peer = peer;
      return peer;
    };

    return {
      websocket: {
        message: (ws, message) => {
          const peer = getPeer(ws);
          hooks["bun:message"]?.(peer, ws, message);
          hooks.message?.(peer, new WebSocketMessage(message));
        },
        open: (ws) => {
          const peer = getPeer(ws);
          hooks["bun:open"]?.(peer, ws);
          hooks.open?.(peer);
        },
        close: (ws) => {
          const peer = getPeer(ws);
          hooks["bun:close"]?.(peer, ws);
          hooks.close?.(peer, {});
        },
        drain: (ws) => {
          const peer = getPeer(ws);
          hooks["bun:drain"]?.(peer);
        },
        // @ts-expect-error types unavailable but mentioned in docs
        error: (ws, error) => {
          const peer = getPeer(ws);
          hooks["bun:error"]?.(peer, ws, error);
          hooks.error?.(peer, new WebSocketError(error));
        },
        ping(ws, data) {
          const peer = getPeer(ws);
          hooks["bun:ping"]?.(peer, ws, data);
        },
        pong(ws, data) {
          const peer = getPeer(ws);
          hooks["bun:pong"]?.(peer, ws, data);
        },
      },
    };
  },
);

class WebSocketPeer extends WebSocketPeerBase<{
  bun: { ws: ServerWebSocket };
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

  send(message: string | ArrayBuffer) {
    this.ctx.bun.ws.send(message);
    return 0;
  }
}
