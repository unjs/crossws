// https://developers.cloudflare.com/workers/examples/websockets/

import type * as _cf from "@cloudflare/workers-types";

import { Peer } from "../peer";
import {
  AdapterOptions,
  AdapterInstance,
  defineWebSocketAdapter,
} from "../types.js";
import { Message } from "../message";
import { WSError } from "../error";
import { AdapterHookable } from "../hooks.js";
import { toBufferLike } from "../_utils";

declare const WebSocketPair: typeof _cf.WebSocketPair;
declare const Response: typeof _cf.Response;

export interface CloudflareAdapter extends AdapterInstance {
  handleUpgrade(
    req: _cf.Request,
    env: unknown,
    context: _cf.ExecutionContext,
  ): Promise<_cf.Response>;
}

export interface CloudflareOptions extends AdapterOptions {}

export default defineWebSocketAdapter<CloudflareAdapter, CloudflareOptions>(
  (options = {}) => {
    const hooks = new AdapterHookable(options);
    const peers = new Set<CloudflarePeer>();
    return {
      peers,
      handleUpgrade: async (request, env, context) => {
        const res = await hooks.callHook(
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
          peers,
          cloudflare: { client, server, request, env, context },
        });
        peers.add(peer);
        server.accept();
        hooks.callAdapterHook("cloudflare:accept", peer);
        hooks.callHook("open", peer);
        server.addEventListener("message", (event) => {
          hooks.callAdapterHook("cloudflare:message", peer, event);
          hooks.callHook("message", peer, new Message(event.data));
        });
        server.addEventListener("error", (event) => {
          peers.delete(peer);
          hooks.callAdapterHook("cloudflare:error", peer, event);
          hooks.callHook("error", peer, new WSError(event.error));
        });
        server.addEventListener("close", (event) => {
          peers.delete(peer);
          hooks.callAdapterHook("cloudflare:close", peer, event);
          hooks.callHook("close", peer, event);
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
  peers: Set<CloudflarePeer>;
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
    return this._internal.cloudflare.request.url;
  }

  get headers() {
    return this._internal.cloudflare.request.headers as unknown as Headers;
  }

  get readyState() {
    return this._internal.cloudflare.client.readyState as -1 | 0 | 1 | 2 | 3;
  }

  send(message: any) {
    this._internal.cloudflare.server.send(toBufferLike(message));
    return 0;
  }

  publish(_topic: string, _message: any): void {
    // Not supported
    // Throws: A hanging Promise was canceled
    // for (const peer of this._internal.peers) {
    //   if (peer !== this && peer._topics.has(_topic)) {
    //     peer.publish(_topic, _message);
    //   }
    // }
  }

  close(code?: number, reason?: string) {
    this._internal.cloudflare.client.close(code, reason);
  }

  terminate(): void {
    this.close();
  }
}
