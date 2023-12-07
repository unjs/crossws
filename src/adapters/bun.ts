// https://bun.sh/docs/api/websockets

import type { BunWSOptions, BunServerWebSocket } from "../../types/bun";
import { WebSocketMessage } from "../message";
import { WebSocketError } from "../error";
import { WebSocketPeer } from "../peer";
import { defineWebSocketAdapter } from "../adapter";

export const WebSocket = globalThis.WebSocket;

export interface AdapterOptions {}

export interface Adapter {
  websocket: BunWSOptions;
}

export default defineWebSocketAdapter<Adapter, AdapterOptions>(
  (handler, opts = {}) => {
    return {
      websocket: {
        message: (ws, message) => {
          handler.onEvent?.("bun:message", ws, message);
          const peer = new BunWebSocketPeer(ws);
          handler.onMessage?.(peer, new WebSocketMessage(message));
        },
        open: (ws) => {
          handler.onEvent?.("bun:open", ws);
          const peer = new BunWebSocketPeer(ws);
          handler.onOpen?.(peer);
        },
        close: (ws) => {
          handler.onEvent?.("bun:close", ws);
          const peer = new BunWebSocketPeer(ws);
          handler.onClose?.(peer, 0, "");
        },
        error: (ws, error) => {
          handler.onEvent?.("bun:error", ws, error);
          const peer = new BunWebSocketPeer(ws);
          handler.onError?.(peer, new WebSocketError(error));
        },
        drain: (ws) => {
          handler.onEvent?.("bun:drain", ws);
        },
      },
    };
  },
);

class BunWebSocketPeer extends WebSocketPeer {
  constructor(private _ws: BunServerWebSocket) {
    super();
  }

  get id() {
    return this._ws.remoteAddress;
  }

  get readyState() {
    return this._ws.readyState as any;
  }

  send(message: string | ArrayBuffer) {
    this._ws.send(message);
    return 0;
  }
}
