// https://deno.land/api?s=WebSocket
// https://deno.land/api?s=Deno.upgradeWebSocket
// https://examples.deno.land/http-server-websocket

import { Message } from "../message";
import { WSError } from "../error";
import { Peer } from "../peer";
import { AdapterOptions, defineWebSocketAdapter } from "../types.js";
import { createCrossWS } from "../crossws";
import { toBufferLike } from "../_utils";

export interface DenoAdapter {
  handleUpgrade(req: Request, info: ServeHandlerInfo): Promise<Response>;
}

export interface DenoOptions extends AdapterOptions {}

declare global {
  const Deno: typeof import("@deno/types").Deno;
}

type WebSocketUpgrade = import("@deno/types").Deno.WebSocketUpgrade;
type ServeHandlerInfo = any; // TODO

export default defineWebSocketAdapter<DenoAdapter, DenoOptions>(
  (options = {}) => {
    const crossws = createCrossWS(options);

    const handleUpgrade = async (req: Request, info: ServeHandlerInfo) => {
      const { headers } = await crossws.upgrade({
        url: req.url,
        headers: req.headers,
      });

      const upgrade = Deno.upgradeWebSocket(req, {
        // @ts-expect-error https://github.com/denoland/deno/pull/22242
        headers,
      });

      const peer = new DenoPeer({
        deno: { ws: upgrade.socket, req, info },
      });

      upgrade.socket.addEventListener("open", () => {
        crossws.$callHook("deno:open", peer);
        crossws.callHook("open", peer);
      });
      upgrade.socket.addEventListener("message", (event) => {
        crossws.$callHook("deno:message", peer, event);
        crossws.callHook("message", peer, new Message(event.data));
      });
      upgrade.socket.addEventListener("close", () => {
        crossws.$callHook("deno:close", peer);
        crossws.callHook("close", peer, {});
      });
      upgrade.socket.addEventListener("error", (error) => {
        crossws.$callHook("deno:error", peer, error);
        crossws.callHook("error", peer, new WSError(error));
      });
      return upgrade.response;
    };

    return {
      handleUpgrade,
    };
  },
);

class DenoPeer extends Peer<{
  deno: {
    ws: WebSocketUpgrade["socket"];
    req: Request;
    info: ServeHandlerInfo;
  };
}> {
  get addr() {
    // @ts-expect-error types missing
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

  send(message: any) {
    this.ctx.deno.ws.send(toBufferLike(message));
    return 0;
  }
}
