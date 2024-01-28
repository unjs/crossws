// https://bun.sh/docs/api/websockets

// @ts-expect-error
import type {} from "bun-types";

import { WebSocketMessage } from "../message";
import { WebSocketError } from "../error";
import { WebSocketPeerBase } from "../peer";
import { defineWebSocketAdapter } from "../adapter";

export const WebSocket = globalThis.WebSocket;

export interface AdapterOptions {}

type ContextData = { _peer?: WebSocketPeer };

type WebSocketHandler = Extract<
  Parameters<typeof Bun.serve<ContextData>>[0],
  { websocket: any }
>["websocket"];

type ServerWebSocket = Parameters<WebSocketHandler["message"]>[0];

export interface Adapter {
  websocket: WebSocketHandler;
}

export default defineWebSocketAdapter<Adapter, AdapterOptions>(
  (handler, opts = {}) => {
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
          handler?.onEvent?.("bun:message", peer, ws, message);
          handler.onMessage?.(peer, new WebSocketMessage(message));
        },
        open: (ws) => {
          const peer = getPeer(ws);
          handler?.onEvent?.("bun:open", peer, ws);
          handler.onOpen?.(peer);
        },
        close: (ws) => {
          const peer = getPeer(ws);
          handler?.onEvent?.("bun:close", peer, ws);
          handler.onClose?.(peer, 0, "");
        },
        drain: (ws) => {
          const peer = getPeer(ws);
          handler?.onEvent?.("bun:drain", peer);
        },
        // @ts-expect-error types unavailable but mentioned in docs
        error: (ws, error) => {
          const peer = getPeer(ws);
          handler?.onEvent?.("bun:error", peer, error);
          handler.onError?.(peer, new WebSocketError(error));
        },
      },
    };
  },
);

class WebSocketPeer extends WebSocketPeerBase<{
  bun: { ws: ServerWebSocket };
}> {
  get id() {
    return this.ctx.bun.ws.remoteAddress;
  }

  get readyState() {
    return this.ctx.bun.ws.readyState as any;
  }

  send(message: string | ArrayBuffer) {
    this.ctx.bun.ws.send(message);
    return 0;
  }
}
