import type { AdapterOptions, AdapterInstance } from "../adapter.ts";
import type * as web from "../../types/web.ts";
import { toBufferLike } from "../utils.ts";
import { defineWebSocketAdapter, adapterUtils } from "../adapter.ts";
import { AdapterHookable } from "../hooks.ts";
import { Message } from "../message.ts";
import { Peer } from "../peer.ts";

import type * as CF from "@cloudflare/workers-types";
import type { DurableObject } from "cloudflare:workers";

// --- types

declare class DurableObjectPub extends DurableObject {
  public ctx: DurableObject["ctx"];
  public env: unknown;
}

type AugmentedWebSocket = CF.WebSocket & {
  _crosswsState?: CrosswsState;
  _crosswsPeer?: CloudflareDurablePeer;
};

type CrosswsState = {
  topics?: Set<string>;
};

export interface CloudflareDurableAdapter extends AdapterInstance {
  handleUpgrade(
    req: Request | CF.Request,
    env: unknown,
    context: CF.ExecutionContext,
  ): Promise<Response>;

  handleDurableUpgrade(
    obj: DurableObject,
    req: Request | CF.Request,
  ): Promise<Response>;

  handleDurableMessage(
    obj: DurableObject,
    ws: WebSocket | CF.WebSocket | web.WebSocket,
    message: ArrayBuffer | string,
  ): Promise<void>;

  handleDurableClose(
    obj: DurableObject,
    ws: WebSocket | CF.WebSocket | web.WebSocket,
    code: number,
    reason: string,
    wasClean: boolean,
  ): Promise<void>;
}

export interface CloudflareOptions extends AdapterOptions {
  bindingName?: string;
  instanceName?: string;
}

// --- adapter ---

// https://developers.cloudflare.com/durable-objects/examples/websocket-hibernation-server/
export default defineWebSocketAdapter<
  CloudflareDurableAdapter,
  CloudflareOptions
>((opts) => {
  const hooks = new AdapterHookable(opts);
  const peers = new Set<CloudflareDurablePeer>();
  return {
    ...adapterUtils(peers),
    handleUpgrade: async (req, env, _context) => {
      const bindingName = opts?.bindingName ?? "$DurableObject";
      const instanceName = opts?.instanceName ?? "crossws";
      const binding = (env as any)[bindingName] as CF.DurableObjectNamespace;
      const id = binding.idFromName(instanceName);
      const stub = binding.get(id);
      return stub.fetch(req as CF.Request) as unknown as Response;
    },
    handleDurableUpgrade: async (obj, request) => {
      const res = await hooks.callHook("upgrade", request as Request);
      if (res instanceof Response) {
        return res;
      }
      const pair = new WebSocketPair();
      const client = pair[0];
      const server = pair[1];
      const peer = peerFromDurableEvent(
        obj,
        server as unknown as CF.WebSocket,
        request,
      );
      peers.add(peer);
      (obj as DurableObjectPub).ctx.acceptWebSocket(server);
      hooks.callAdapterHook("cloudflare:accept", peer);
      hooks.callHook("open", peer);
      // eslint-disable-next-line unicorn/no-null
      return new Response(null, {
        status: 101,
        webSocket: client,
        headers: res?.headers,
      });
    },
    handleDurableMessage: async (obj, ws, message) => {
      const peer = peerFromDurableEvent(obj, ws as CF.WebSocket);
      hooks.callAdapterHook("cloudflare:message", peer, message);
      hooks.callHook("message", peer, new Message(message, peer));
    },
    handleDurableClose: async (obj, ws, code, reason, wasClean) => {
      const peer = peerFromDurableEvent(obj, ws as CF.WebSocket);
      peers.delete(peer);
      const details = { code, reason, wasClean };
      hooks.callAdapterHook("cloudflare:close", peer, details);
      hooks.callHook("close", peer, details);
    },
  };
});

function peerFromDurableEvent(
  obj: DurableObject,
  ws: AugmentedWebSocket,
  request?: Request | CF.Request,
): CloudflareDurablePeer {
  let peer = ws._crosswsPeer;
  if (peer) {
    return peer;
  }
  peer = ws._crosswsPeer = new CloudflareDurablePeer({
    ws: ws as CF.WebSocket,
    request: request as Request,
    cfEnv: (obj as DurableObjectPub).env,
    cfCtx: (obj as DurableObjectPub).ctx,
  });
  return peer;
}

// --- peer ---

class CloudflareDurablePeer extends Peer<{
  ws: AugmentedWebSocket;
  request?: Request;
  peers?: never;
  cfEnv: unknown;
  cfCtx: DurableObject["ctx"];
}> {
  get peers() {
    const clients =
      this._internal.cfCtx.getWebSockets() as unknown as (typeof this._internal.ws)[];
    return new Set(
      clients.map((client) => {
        let peer = client._crosswsPeer;
        if (!peer) {
          peer = client._crosswsPeer = new CloudflareDurablePeer({
            ws: client,
            request: undefined,
            cfEnv: this._internal.cfEnv,
            cfCtx: this._internal.cfCtx,
          });
        }
        return peer;
      }),
    );
  }

  send(data: unknown) {
    return this._internal.ws.send(toBufferLike(data));
  }

  subscribe(topic: string): void {
    super.subscribe(topic);
    const state: CrosswsState = {
      // Max limit: 2,048 bytes
      ...(this._internal.ws.deserializeAttachment() as CrosswsState),
      topics: this._topics,
    };
    this._internal.ws._crosswsState = state;
    this._internal.ws.serializeAttachment(state);
  }

  publish(topic: string, data: unknown): void {
    const clients = (
      this._internal.cfCtx.getWebSockets() as unknown as (typeof this._internal.ws)[]
    ).filter((c) => c !== this._internal.ws);
    if (clients.length === 0) {
      return;
    }
    const dataBuff = toBufferLike(data);
    for (const client of clients) {
      let state = client._crosswsState;
      if (!state) {
        state = client._crosswsState =
          client.deserializeAttachment() as CrosswsState;
      }
      if (state.topics?.has(topic)) {
        client.send(dataBuff);
      }
    }
  }

  close(code?: number, reason?: string) {
    this._internal.ws.close(code, reason);
  }
}
