import type { WebSocketHandler, ServerWebSocket, Server } from "bun";
import type { AdapterOptions, AdapterInstance } from "../adapter.ts";
import { toBufferLike } from "../utils.ts";
import { defineWebSocketAdapter, adapterUtils } from "../adapter.ts";
import { AdapterHookable, formatRejection, Reasons } from "../hooks.ts";
import { Message } from "../message.ts";
import { Peer } from "../peer.ts";

// --- types ---

export interface BunAdapter extends AdapterInstance {
  websocket: WebSocketHandler<ContextData>;
  handleUpgrade(req: Request, server: Server): Promise<Response | undefined>;
}

export interface BunOptions extends AdapterOptions { }

type ContextData = {
  peer?: BunPeer;
  request: Request;
  server?: Server;
};

// --- adapter ---

// https://bun.sh/docs/api/websockets
export default defineWebSocketAdapter<BunAdapter, BunOptions>(
  (options = {}) => {
    const hooks = new AdapterHookable(options);
    const peers = new Set<BunPeer>();
    return {
      ...adapterUtils(peers),
      async handleUpgrade(request, server) {
        let response: Response | undefined;

        /** Accept the Websocket upgrade request. */
        function accept(params?: { headers?: HeadersInit }): void {
          if (!server.upgrade(request, {
            headers: params?.headers,
            data: {
              server,
              request,
            } satisfies ContextData,
          })) {
            response = new Response("Upgrade failed", { status: 500 });
          };
        }

        /** Reject the Websocket upgrade request */
        function reject(reason: Reasons): void {
          response = formatRejection({ reason, type: "Response" })
        }

        await hooks.callHook("upgrade", request, { accept, reject });
        if (response instanceof Response) {
          return response;
        }
      },
      websocket: {
        message: (ws, message) => {
          const peer = getPeer(ws, peers);
          hooks.callHook("message", peer, new Message(message, peer));
        },
        open: (ws) => {
          const peer = getPeer(ws, peers);
          peers.add(peer);
          hooks.callHook("open", peer);
        },
        close: (ws) => {
          const peer = getPeer(ws, peers);
          peers.delete(peer);
          hooks.callHook("close", peer, {});
        },
      },
    };
  },
);

// --- peer ---

function getPeer(
  ws: ServerWebSocket<ContextData>,
  peers: Set<BunPeer>,
): BunPeer {
  if (ws.data?.peer) {
    return ws.data.peer;
  }
  const peer = new BunPeer({ ws, request: ws.data.request, peers });
  ws.data = {
    ...ws.data,
    peer,
  };
  return peer;
}

class BunPeer extends Peer<{
  ws: ServerWebSocket<ContextData>;
  request: Request;
  peers: Set<BunPeer>;
}> {
  get remoteAddress() {
    return this._internal.ws.remoteAddress;
  }

  send(data: unknown, options?: { compress?: boolean }) {
    return this._internal.ws.send(toBufferLike(data), options?.compress);
  }

  publish(topic: string, data: unknown, options?: { compress?: boolean }) {
    return this._internal.ws.publish(
      topic,
      toBufferLike(data),
      options?.compress,
    );
  }

  subscribe(topic: string): void {
    this._internal.ws.subscribe(topic);
  }

  unsubscribe(topic: string): void {
    this._internal.ws.unsubscribe(topic);
  }

  close(code?: number, reason?: string) {
    this._internal.ws.close(code, reason);
  }

  terminate() {
    this._internal.ws.terminate();
  }
}
