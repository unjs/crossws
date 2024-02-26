// https://developers.cloudflare.com/workers/examples/websockets/

import type * as _cf from "@cloudflare/workers-types";

import { Peer } from "../peer";
import { AdapterOptions, defineWebSocketAdapter } from "../types.js";
import { Message } from "../message";
import { WSError } from "../error";
import { createCrossWS } from "../crossws";
import { toBufferLike } from "../_utils";

type Env = Record<string, any>;

declare const WebSocketPair: typeof _cf.WebSocketPair;
declare const Response: typeof _cf.Response;

export interface CloudflareAdapter {
  handleUpgrade(
    req: _cf.Request,
    env: Env,
    context: _cf.ExecutionContext,
  ): Promise<_cf.Response>;
}

export interface CloudflareOptions extends AdapterOptions {}

export default defineWebSocketAdapter<CloudflareAdapter, CloudflareOptions>(
  (options = {}) => {
    const crossws = createCrossWS(options);

    const handleUpgrade = async (
      req: _cf.Request,
      env: Env,
      context: _cf.ExecutionContext,
    ) => {
      const pair = new WebSocketPair();
      const client = pair[0];
      const server = pair[1];

      const peer = new CloudflarePeer({
        cloudflare: { client, server, req, env, context },
      });

      const { headers } = await crossws.upgrade(peer);

      server.accept();
      crossws.$callHook("cloudflare:accept", peer);
      crossws.callHook("open", peer);

      server.addEventListener("message", (event) => {
        crossws.$callHook("cloudflare:message", peer, event);
        crossws.callHook("message", peer, new Message(event.data));
      });

      server.addEventListener("error", (event) => {
        crossws.$callHook("cloudflare:error", peer, event);
        crossws.callHook("error", peer, new WSError(event.error));
      });

      server.addEventListener("close", (event) => {
        crossws.$callHook("cloudflare:close", peer, event);
        crossws.callHook("close", peer, {
          code: event.code,
          reason: event.reason,
        });
      });

      // eslint-disable-next-line unicorn/no-null
      return new Response(null, {
        status: 101,
        webSocket: client,
        headers,
      });
    };

    return {
      handleUpgrade,
    };
  },
);

class CloudflarePeer extends Peer<{
  cloudflare: {
    client: _cf.WebSocket;
    server: _cf.WebSocket;
    req: _cf.Request;
    env: Env;
    context: _cf.ExecutionContext;
  };
}> {
  get addr() {
    return undefined;
  }

  get url() {
    return this.ctx.cloudflare.req.url;
  }

  get headers() {
    return this.ctx.cloudflare.req.headers as Headers;
  }

  get readyState() {
    return this.ctx.cloudflare.client.readyState as -1 | 0 | 1 | 2 | 3;
  }

  send(message: any) {
    this.ctx.cloudflare.server.send(toBufferLike(message));
    return 0;
  }
}
