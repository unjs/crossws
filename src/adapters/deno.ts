// https://deno.land/api?s=WebSocket
// https://deno.land/api?s=Deno.upgradeWebSocket
// https://examples.deno.land/http-server-websocket

import { Message } from "../message.ts";
import { WSError } from "../error.ts";
import { Peer } from "../peer.ts";
import {
  AdapterOptions,
  AdapterInstance,
  defineWebSocketAdapter,
} from "../types.ts";
import { AdapterHookable } from "../hooks.ts";
import { toBufferLike } from "../_utils.ts";

export interface DenoAdapter extends AdapterInstance {
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
    const hooks = new AdapterHookable(options);
    const peers = new Set<DenoPeer>();
    return {
      peers,
      handleUpgrade: async (request, info) => {
        const res = await hooks.callHook("upgrade", request);
        if (res instanceof Response) {
          return res;
        }
        const upgrade = Deno.upgradeWebSocket(request, {
          // @ts-expect-error https://github.com/denoland/deno/pull/22242
          headers: res?.headers,
        });
        const peer = new DenoPeer({
          peers,
          deno: { ws: upgrade.socket, request, info },
        });
        peers.add(peer);
        upgrade.socket.addEventListener("open", () => {
          hooks.callAdapterHook("deno:open", peer);
          hooks.callHook("open", peer);
        });
        upgrade.socket.addEventListener("message", (event) => {
          hooks.callAdapterHook("deno:message", peer, event);
          hooks.callHook("message", peer, new Message(event.data));
        });
        upgrade.socket.addEventListener("close", () => {
          peers.delete(peer);
          hooks.callAdapterHook("deno:close", peer);
          hooks.callHook("close", peer, {});
        });
        upgrade.socket.addEventListener("error", (error) => {
          peers.delete(peer);
          hooks.callAdapterHook("deno:error", peer, error);
          hooks.callHook("error", peer, new WSError(error));
        });
        return upgrade.response;
      },
    };
  },
);

class DenoPeer extends Peer<{
  peers: Set<DenoPeer>;
  deno: {
    ws: WebSocketUpgrade["socket"];
    request: Request;
    info: ServeHandlerInfo;
  };
}> {
  get addr() {
    // @ts-expect-error types missing
    return this._internal.deno.ws.remoteAddress;
  }

  get readyState() {
    return this._internal.deno.ws.readyState as -1 | 0 | 1 | 2 | 3;
  }

  get url() {
    return this._internal.deno.request.url;
  }

  get headers() {
    return this._internal.deno.request.headers || new Headers();
  }

  send(message: any) {
    this._internal.deno.ws.send(toBufferLike(message));
    return 0;
  }

  publish(topic: string, message: any) {
    const data = toBufferLike(message);
    for (const peer of this._internal.peers) {
      if (peer !== this && peer._topics.has(topic)) {
        peer._internal.deno.ws.send(data);
      }
    }
  }

  close(code?: number, reason?: string) {
    this._internal.deno.ws.close(code, reason);
  }

  terminate(): void {
    // @ts-ignore (terminate is Deno-only api)
    this._internal.deno.ws.terminate();
  }
}
