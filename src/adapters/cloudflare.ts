import type { AdapterOptions, AdapterInstance } from "../adapter.ts";
import { toBufferLike } from "../utils.ts";
import { defineWebSocketAdapter, adapterUtils } from "../adapter.ts";
import { AdapterHookable } from "../hooks.ts";
import { Message } from "../message.ts";
import { WSError } from "../error.ts";
import { Peer } from "../peer.ts";

import type * as _cf from "@cloudflare/workers-types";

// --- types ---

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

// --- adapter ---

// https://developers.cloudflare.com/workers/examples/websockets/
export default defineWebSocketAdapter<CloudflareAdapter, CloudflareOptions>(
  (options = {}) => {
    const hooks = new AdapterHookable(options);
    const peers = new Set<CloudflarePeer>();
    return {
      ...adapterUtils(peers),
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
          ws: client,
          peers,
          wsServer: server,
          request: request as unknown as Request,
          cfEnv: env,
          cfCtx: context,
        });
        peers.add(peer);
        server.accept();
        hooks.callAdapterHook("cloudflare:accept", peer);
        hooks.callHook("open", peer);
        server.addEventListener("message", (event) => {
          hooks.callAdapterHook("cloudflare:message", peer, event);
          hooks.callHook(
            "message",
            peer,
            new Message(event.data, peer, event as MessageEvent),
          );
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

// --- peer ---

class CloudflarePeer extends Peer<{
  ws: _cf.WebSocket;
  request: Request;
  peers: Set<CloudflarePeer>;
  wsServer: _cf.WebSocket;
  cfEnv: unknown;
  cfCtx: _cf.ExecutionContext;
}> {
  send(data: unknown) {
    this._internal.wsServer.send(toBufferLike(data));
    return 0;
  }

  publish(_topic: string, _message: any): void {
    // not supported
  }

  close(code?: number, reason?: string) {
    this._internal.ws.close(code, reason);
  }
}
