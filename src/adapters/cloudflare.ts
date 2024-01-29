// https://developers.cloudflare.com/workers/examples/websockets/

import type * as _cf from "@cloudflare/workers-types";

import { WebSocketPeerBase } from "../peer";
import { defineWebSocketAdapter } from "../adapter.js";
import { WebSocketMessage } from "../message";
import { WebSocketError } from "../error";

type Env = Record<string, any>;

declare const WebSocketPair: typeof _cf.WebSocketPair;
declare const Response: typeof _cf.Response;

export interface AdapterOptions {}

export interface Adapter {
  handleUpgrade(
    req: _cf.Request,
    env: Env,
    context: _cf.ExecutionContext,
  ): _cf.Response;
}

export default defineWebSocketAdapter<Adapter, AdapterOptions>(
  (hooks, opts = {}) => {
    const handleUpgrade = (
      request: _cf.Request,
      env: Env,
      context: _cf.ExecutionContext,
    ) => {
      const pair = new WebSocketPair();
      const client = pair[0];
      const server = pair[1];

      const peer = new CloudflareWebSocketPeer({
        cloudflare: { client, server, request, env, context },
      });

      server.accept();

      hooks["cloudflare:accept"]?.(peer);
      hooks.open?.(peer);

      server.addEventListener("message", (event) => {
        hooks["cloudflare:message"]?.(peer, event);
        hooks.message?.(peer, new WebSocketMessage(event.data));
      });

      server.addEventListener("error", (event) => {
        hooks["cloudflare:error"]?.(peer, event);
        hooks.error?.(peer, new WebSocketError(event.error));
      });

      server.addEventListener("close", (event) => {
        hooks["cloudflare:close"]?.(peer, event);
        hooks.close?.(peer, { code: event.code, reason: event.reason });
      });

      // eslint-disable-next-line unicorn/no-null
      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    };

    return {
      handleUpgrade,
    };
  },
);

class CloudflareWebSocketPeer extends WebSocketPeerBase<{
  cloudflare: {
    client: _cf.WebSocket;
    server: _cf.WebSocket;
    request: _cf.Request;
    env: Env;
    context: _cf.ExecutionContext;
  };
}> {
  get id() {
    return undefined;
  }

  get readyState() {
    return this.ctx.cloudflare.client.readyState as -1 | 0 | 1 | 2 | 3;
  }

  send(message: string | ArrayBuffer) {
    this.ctx.cloudflare.server.send(message);
    return 0;
  }
}