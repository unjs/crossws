// https://deno.land/api?s=WebSocket
// https://deno.land/api?s=Deno.upgradeWebSocket
// https://examples.deno.land/http-server-websocket

import { WebSocketMessage } from "../message";
import { WebSocketError } from "../error";
import { WebSocketPeerBase } from "../peer";
import { defineWebSocketAdapter } from "../adapter.js";

export interface AdapterOptions {}

export interface Adapter {
  handleUpgrade(req: Request): Response;
}

declare global {
  const Deno: typeof import("@deno/types").Deno;
}

export default defineWebSocketAdapter<Adapter, AdapterOptions>(
  (hooks, opts = {}) => {
    const handleUpgrade = (request: Request) => {
      const upgrade = Deno.upgradeWebSocket(request);
      const peer = new DenoWebSocketPeer({
        deno: { ws: upgrade.socket, request },
      });
      upgrade.socket.addEventListener("open", () => {
        hooks["deno:open"]?.(peer);
        hooks.open?.(peer);
      });
      upgrade.socket.addEventListener("message", (event) => {
        hooks["deno:message"]?.(peer, event);
        hooks.message?.(peer, new WebSocketMessage(event.data));
      });
      upgrade.socket.addEventListener("close", () => {
        hooks["deno:close"]?.(peer);
        hooks.close?.(peer, {});
      });
      upgrade.socket.addEventListener("error", (error) => {
        hooks["deno:error"]?.(peer, error);
        hooks.error?.(peer, new WebSocketError(error));
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
