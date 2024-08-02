import type * as CF from "@cloudflare/workers-types";
import type { DurableObject } from "cloudflare:workers";
import { AdapterOptions, defineWebSocketAdapter } from "../types";
import { Peer } from "../peer";
import { Message } from "../message";
import { createCrossWS } from "../crossws";
import { toBufferLike } from "../_utils";

declare class DurableObjectPub extends DurableObject {
  public ctx: DurableObject["ctx"];
  public env: unknown;
}

type CrosswsState = {
  topics?: Set<string>;
};

export interface CloudflareDurableAdapter {
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
    ws: WebSocket | CF.WebSocket,
    message: ArrayBuffer | string,
  ): Promise<void>;

  handleDurableClose(
    obj: DurableObject,
    ws: WebSocket | CF.WebSocket,
    code: number,
    reason: string,
    wasClean: boolean,
  ): Promise<void>;
}

export interface CloudflareOptions extends AdapterOptions {
  bindingName?: string;
  instanceName?: string;
}

export default defineWebSocketAdapter<
  CloudflareDurableAdapter,
  CloudflareOptions
>((opts) => {
  const crossws = createCrossWS(opts);

  const handleUpgrade: CloudflareDurableAdapter["handleUpgrade"] = async (
    req,
    env,
    _context,
  ) => {
    const bindingName = opts?.bindingName ?? "$DurableObject";
    const instanceName = opts?.instanceName ?? "crossws";
    const binding = (env as any)[bindingName] as CF.DurableObjectNamespace;
    const id = binding.idFromName(instanceName);
    const stub = binding.get(id);
    return stub.fetch(req as CF.Request) as unknown as Response;
  };

  const handleDurableUpgrade: CloudflareDurableAdapter["handleDurableUpgrade"] =
    async (obj, req) => {
      const pair = new WebSocketPair();
      const client = pair[0];
      const server = pair[1];
      const peer = peerFromDurableEvent(obj, server);

      const { headers } = await crossws.upgrade(peer);

      (obj as DurableObjectPub).ctx.acceptWebSocket(server);

      crossws.$callHook("cloudflare:accept", peer);
      crossws.callHook("open", peer);

      // eslint-disable-next-line unicorn/no-null
      return new Response(null, {
        status: 101,
        webSocket: client,
        headers,
      });
    };

  const handleDurableMessage: CloudflareDurableAdapter["handleDurableMessage"] =
    async (obj, ws, message) => {
      const peer = peerFromDurableEvent(obj, ws);
      crossws.$callHook("cloudflare:message", peer, message);
      crossws.callHook("message", peer, new Message(message));
    };

  const handleDurableClose: CloudflareDurableAdapter["handleDurableClose"] =
    async (obj, ws, code, reason, wasClean) => {
      const peer = peerFromDurableEvent(obj, ws);
      const details = { code, reason, wasClean };
      crossws.$callHook("cloudflare:close", peer, details);
      crossws.callHook("close", peer, details);
      ws.close(code, reason);
    };

  return {
    handleUpgrade,
    handleDurableUpgrade,
    handleDurableClose,
    handleDurableMessage,
  };
});

function peerFromDurableEvent(
  obj: DurableObject,
  ws: WebSocket | CF.WebSocket,
) {
  return new CloudflareDurablePeer({
    cloudflare: {
      ws: ws as CF.WebSocket,
      env: (obj as DurableObjectPub).env,
      context: (obj as DurableObjectPub).ctx,
    },
  });
}

class CloudflareDurablePeer extends Peer<{
  cloudflare: {
    ws: CF.WebSocket & { _crossws?: CrosswsState };
    env: unknown;
    context: DurableObject["ctx"];
  };
}> {
  get url() {
    return this.ctx.cloudflare.ws.url || "";
  }

  get readyState() {
    return this.ctx.cloudflare.ws.readyState as -1 | 0 | 1 | 2 | 3;
  }

  send(message: any) {
    this.ctx.cloudflare.ws.send(toBufferLike(message));
    return 0;
  }

  subscribe(topic: string): void {
    super.subscribe(topic);
    const state: CrosswsState = {
      topics: this._subscriptions,
    };
    this.ctx.cloudflare.ws._crossws = state;
    // Max limit: 2,048 bytes
    this.ctx.cloudflare.ws.serializeAttachment(state);
  }

  publish(topic: string, message: any): void {
    const clients =
      this.ctx.cloudflare.context.getWebSockets() as unknown as (typeof this.ctx.cloudflare.ws)[];
    if (clients.length === 0) {
      return;
    }
    const data = toBufferLike(message);
    for (const client of clients) {
      let state = client._crossws;
      if (!state) {
        state = client._crossws =
          client.deserializeAttachment() as CrosswsState;
      }
      if (state.topics?.has(topic)) {
        client.send(data);
      }
    }
  }

  close(code?: number, reason?: string) {
    this.ctx.cloudflare.ws.close(code, reason);
  }

  terminate(): void {
    this.close();
  }
}
