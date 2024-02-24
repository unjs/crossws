// https://deno.land/api?s=WebSocket
// https://deno.land/api?s=Deno.upgradeWebSocket
// https://examples.deno.land/http-server-websocket

import { WebSocketMessage } from "../message";
import { WebSocketError } from "../error";
import { WSPeer } from "../peer";
import { defineWebSocketAdapter } from "../adapter.js";
import { CrossWSOptions, createCrossWS } from "../crossws";

export interface AdapterOptions extends CrossWSOptions {}

export interface Adapter {
  handleUpgrade(req: Request): Promise<Response>;
}

declare global {
  const Deno: typeof import("@deno/types").Deno;
}

export default defineWebSocketAdapter<Adapter, AdapterOptions>(
  (hooks, options = {}) => {
    const crossws = createCrossWS(hooks, options);

    const handleUpgrade = async (req: Request) => {
      const { headers } = await crossws.upgrade({
        url: req.url,
        headers: req.headers,
      });

      const upgrade = Deno.upgradeWebSocket(req, {
        // @ts-expect-error https://github.com/denoland/deno/pull/22242
        headers,
      });

      const peer = new DenoWSPeer({
        deno: { ws: upgrade.socket, req },
      });

      upgrade.socket.addEventListener("open", () => {
        crossws.$("deno:open", peer);
        crossws.open(peer);
      });
      upgrade.socket.addEventListener("message", (event) => {
        crossws.$("deno:message", peer, event);
        crossws.message(peer, new WebSocketMessage(event.data));
      });
      upgrade.socket.addEventListener("close", () => {
        crossws.$("deno:close", peer);
        crossws.close(peer, {});
      });
      upgrade.socket.addEventListener("error", (error) => {
        crossws.$("deno:error", peer, error);
        crossws.error(peer, new WebSocketError(error));
      });
      return upgrade.response;
    };

    return {
      handleUpgrade,
    };
  },
);

class DenoWSPeer extends WSPeer<{
  deno: { ws: any; req: Request };
}> {
  get id() {
    return this.ctx.deno.ws.remoteAddress;
  }

  get readyState() {
    return this.ctx.deno.ws.readyState as -1 | 0 | 1 | 2 | 3;
  }

  get url() {
    return this.ctx.deno.req.url;
  }

  get headers() {
    return this.ctx.deno.req.headers || new Headers();
  }

  send(message: string | ArrayBuffer) {
    this.ctx.deno.ws.send(message);
    return 0;
  }
}
