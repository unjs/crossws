// https://developers.cloudflare.com/workers/examples/websockets/

import type * as _cf from "@cloudflare/workers-types";

import { Peer } from "../peer";
import { AdapterOptions, defineWebSocketAdapter } from "../types.js";
import { Message } from "../message";
import { WSError } from "../error";
import { CrossWS } from "../crossws";
import { toBufferLike } from "../_utils";

declare const WebSocketPair: typeof _cf.WebSocketPair;
declare const Response: typeof _cf.Response;

export interface CloudflareAdapter {
  handleUpgrade(
    req: _cf.Request,
    env: unknown,
    context: _cf.ExecutionContext,
  ): Promise<_cf.Response>;
}

export interface CloudflareOptions extends AdapterOptions {}

export default defineWebSocketAdapter<CloudflareAdapter, CloudflareOptions>(
  (options = {}) => {
    const crossws = new CrossWS(options);
    return {
      handleUpgrade: async (request, env, context) => {
        const res = await crossws.callHook(
          "upgrade",
          request as unknown as Request,
        );
        if (res instanceof Response) {
          return res;
        }
        const pair = new WebSocketPair();
        const client = pair[0];
        const server = pair[1];
        const peer = new CloudflarePeer({
          cloudflare: { client, server, request, env, context },
        });
        server.accept();
        crossws.callAdapterHook("cloudflare:accept", peer);
        crossws.callHook("open", peer);
        server.addEventListener("message", (event) => {
          crossws.callAdapterHook("cloudflare:message", peer, event);
          crossws.callHook("message", peer, new Message(event.data));
        });
        server.addEventListener("error", (event) => {
          crossws.callAdapterHook("cloudflare:error", peer, event);
          crossws.callHook("error", peer, new WSError(event.error));
        });
        server.addEventListener("close", (event) => {
          crossws.callAdapterHook("cloudflare:close", peer, event);
          crossws.callHook("close", peer, event);
        });
        // eslint-disable-next-line unicorn/no-null
        return new Response(null, {
          status: 101,
          webSocket: client,
          headers: res?.headers,
        });
      },
    };
  },
);

class CloudflarePeer extends Peer<{
  cloudflare: {
    client: _cf.WebSocket;
    server: _cf.WebSocket;
    request: _cf.Request;
    env: unknown;
    context: _cf.ExecutionContext;
  };
}> {
  get addr() {
    return undefined;
  }

  get url() {
    return this.ctx.cloudflare.request.url;
  }

  get headers() {
    return this.ctx.cloudflare.request.headers as unknown as Headers;
  }

  get readyState() {
    return this.ctx.cloudflare.client.readyState as -1 | 0 | 1 | 2 | 3;
  }

  send(message: any) {
    this.ctx.cloudflare.server.send(toBufferLike(message));
    return 0;
  }

  close(code?: number, reason?: string) {
    this.ctx.cloudflare.client.close(code, reason);
  }

  terminate(): void {
    this.close();
  }
}
