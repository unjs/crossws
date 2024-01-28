// https://deno.land/api?s=WebSocket
// https://deno.land/api?s=Deno.upgradeWebSocket
// https://examples.deno.land/http-server-websocket

// @ts-nocheck
import type * as _deno from "../../types/lib.deno.d.ts";

import { WebSocketMessage } from "../message";
import { WebSocketError } from "../error";
import { WebSocketPeer } from "../peer";
import { defineWebSocketAdapter } from "../adapter.js";

export const WebSocket = globalThis.WebSocket;

export interface AdapterOptions {}

export interface Adapter {
  handleUpgrade(req: Deno.Request): Response;
}

export default defineWebSocketAdapter<Adapter, AdapterOptions>(
  (handler, opts = {}) => {
    const handleUpgrade = (req: Request) => {
      const upgrade = Deno.upgradeWebSocket(req);
      upgrade.socket.addEventListener("open", () => {
        handler.onEvent?.("deno:open", upgrade.socket);
        const peer = new DenoWebSocketPeer(upgrade.socket);
        handler.onOpen?.(peer);
      });
      upgrade.socket.addEventListener("message", (event) => {
        handler.onEvent?.("deno:message", upgrade.socket, event);
        const peer = new DenoWebSocketPeer(upgrade.socket);
        handler.onMessage?.(peer, new WebSocketMessage(event.data));
      });
      upgrade.socket.addEventListener("close", () => {
        handler.onEvent?.("deno:close", upgrade.socket);
        const peer = new DenoWebSocketPeer(upgrade.socket);
        handler.onClose?.(peer, 0, "");
      });
      upgrade.socket.addEventListener("error", (error) => {
        handler.onEvent?.("deno:error", upgrade.socket, error);
        const peer = new DenoWebSocketPeer(upgrade.socket);
        handler.onError?.(peer, new WebSocketError(error));
      });
      return upgrade.response;
    };

    return {
      handleUpgrade,
    };
  },
);

class DenoWebSocketPeer extends WebSocketPeer {
  constructor(private _ws: DenoWebSocketPeer) {
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
