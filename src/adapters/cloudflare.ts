// https://developers.cloudflare.com/workers/examples/websockets/

import type * as _cf from "@cloudflare/workers-types";

import { WebSocketPeer } from "../peer";
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
  (handler, opts = {}) => {
    const handleUpgrade = (
      req: _cf.Request,
      env: Env,
      context: _cf.ExecutionContext,
    ) => {
      const pair = new WebSocketPair();
      const client = pair[0];
      const server = pair[1];

      const peer = new CloudflareWebSocketPeer(client, server);

      server.accept();

      // open event is not fired by cloudflare!
      handler.onOpen?.(peer);

      server.addEventListener("message", (event) => {
        handler.onMessage?.(peer, new WebSocketMessage(event.data));
      });

      server.addEventListener("error", (event) => {
        handler.onError?.(peer, new WebSocketError(event.error));
      });

      server.addEventListener("close", (event) => {
        handler.onClose?.(peer, event.code, event.reason);
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

class CloudflareWebSocketPeer extends WebSocketPeer {
  constructor(
    private _client: _cf.WebSocket,
    private _server: _cf.WebSocket,
  ) {
    super();
  }

  get id() {
    return undefined;
  }

  get readyState() {
    return this._client.readyState as -1 | 0 | 1 | 2 | 3;
  }

  send(message: string | ArrayBuffer) {
    this._server.send(message);
    return 0;
  }
}
