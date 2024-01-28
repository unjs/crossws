// https://deno.land/api?s=WebSocket
// https://deno.land/api?s=Deno.upgradeWebSocket
// https://examples.deno.land/http-server-websocket

import "../../types/lib.deno.d.ts";

import { WebSocketMessage } from "../message";
import { WebSocketError } from "../error";
import { WebSocketPeerBase } from "../peer";
import { defineWebSocketAdapter } from "../adapter.js";

export interface AdapterOptions {}

export interface Adapter {
  handleUpgrade(req: Request): Response;
}

export default defineWebSocketAdapter<Adapter, AdapterOptions>(
  (handler, opts = {}) => {
    const handleUpgrade = (request: Request) => {
      const upgrade = Deno.upgradeWebSocket(request);
      const peer = new DenoWebSocketPeer({
        deno: { ws: upgrade.socket, request },
      });
      upgrade.socket.addEventListener("open", () => {
        handler.onEvent?.("deno:open", peer);
        handler.onOpen?.(peer);
      });
      upgrade.socket.addEventListener("message", (event) => {
        handler.onEvent?.("deno:message", peer, event);
        handler.onMessage?.(peer, new WebSocketMessage(event.data));
      });
      upgrade.socket.addEventListener("close", () => {
        handler.onEvent?.("deno:close", peer);
        handler.onClose?.(peer, 0, "");
      });
      upgrade.socket.addEventListener("error", (error) => {
        handler.onEvent?.("deno:error", peer, error);
        handler.onError?.(peer, new WebSocketError(error));
      });
      return upgrade.response;
    };

    return {
      handleUpgrade,
    };
  },
);

class DenoWebSocketPeer extends WebSocketPeerBase<{
  deno: { ws: any; request: Request };
}> {
  get id() {
    return this.ctx.deno.ws.remoteAddress;
  }

  get readyState() {
    return this.ctx.deno.ws.readyState as -1 | 0 | 1 | 2 | 3;
  }

  send(message: string | ArrayBuffer) {
    this.ctx.deno.ws.send(message);
    return 0;
  }
}
