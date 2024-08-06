// https://deno.land/api?s=WebSocket
// https://deno.land/api?s=Deno.upgradeWebSocket
// https://examples.deno.land/http-server-websocket

import { Message } from "../message.ts";
import { WSError } from "../error.ts";
import { Peer } from "../peer.ts";
import { AdapterOptions, defineWebSocketAdapter } from "../types.ts";
import { CrossWS } from "../crossws.ts";
import { toBufferLike } from "../_utils.ts";

export interface DenoAdapter {
  handleUpgrade(req: Request, info: ServeHandlerInfo): Promise<Response>;
}

export interface DenoOptions extends AdapterOptions {}

declare global {
  const Deno: typeof import("@deno/types").Deno;
}

type WebSocketUpgrade = import("@deno/types").Deno.WebSocketUpgrade;
type ServeHandlerInfo = unknown; // TODO

export default defineWebSocketAdapter<DenoAdapter, DenoOptions>(
  (options = {}) => {
    const crossws = new CrossWS(options);
    return {
      handleUpgrade: async (request, info) => {
        const res = await crossws.callHook("upgrade", request);
        if (res instanceof Response) {
          return res;
        }
        const upgrade = Deno.upgradeWebSocket(request, {
          // @ts-expect-error https://github.com/denoland/deno/pull/22242
          headers: res?.headers,
        });
        const peer = new DenoPeer({
          deno: { ws: upgrade.socket, request, info },
        });
        upgrade.socket.addEventListener("open", () => {
          crossws.callAdapterHook("deno:open", peer);
          crossws.callHook("open", peer);
        });
        upgrade.socket.addEventListener("message", (event) => {
          crossws.callAdapterHook("deno:message", peer, event);
          crossws.callHook("message", peer, new Message(event.data));
        });
        upgrade.socket.addEventListener("close", () => {
          crossws.callAdapterHook("deno:close", peer);
          crossws.callHook("close", peer, {});
        });
        upgrade.socket.addEventListener("error", (error) => {
          crossws.callAdapterHook("deno:error", peer, error);
          crossws.callHook("error", peer, new WSError(error));
        });
        return upgrade.response;
      },
    };
  },
);

class DenoPeer extends Peer<{
  deno: {
    ws: WebSocketUpgrade["socket"];
    request: Request;
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
    return this.ctx.deno.request.url;
  }

  get headers() {
    return this.ctx.deno.request.headers || new Headers();
  }

  send(message: any) {
    this.ctx.deno.ws.send(toBufferLike(message));
    return 0;
  }

  close(code?: number, reason?: string) {
    this.ctx.deno.ws.close(code, reason);
  }

  terminate(): void {
    // @ts-ignore (terminate is Deno-only api)
    this.ctx.deno.ws.terminate();
  }
}
