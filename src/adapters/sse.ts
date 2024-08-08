import type { AdapterOptions, AdapterInstance } from "../adapter.ts";
import { toString } from "../utils.ts";
import { defineWebSocketAdapter, adapterUtils } from "../adapter.ts";
import { AdapterHookable } from "../hooks.ts";
import { Message } from "../message.ts";
import { Peer } from "../peer.ts";

// --- types ---

export interface SSEAdapter extends AdapterInstance {
  fetch(req: Request): Promise<Response>;
}

export interface SSEOptions extends AdapterOptions {
  bidir?: boolean;
}

// --- adapter ---

// https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events
export default defineWebSocketAdapter<SSEAdapter, SSEOptions>((opts = {}) => {
  const hooks = new AdapterHookable(opts);
  const peers = new Set<SSEPeer>();
  const peersMap = opts.bidir ? new Map<string, SSEPeer>() : undefined;

  return {
    ...adapterUtils(peers),
    fetch: async (request: Request) => {
      const _res = await hooks.callHook("upgrade", request);
      if (_res instanceof Response) {
        return _res;
      }

      let peer: SSEPeer;

      if (opts.bidir && request.body && request.headers.has("x-crossws-id")) {
        // Accept bidirectional streaming request
        const id = request.headers.get("x-crossws-id")!;
        peer = peersMap?.get(id) as SSEPeer;
        if (!peer) {
          return new Response("invalid peer id", { status: 400 });
        }
        const stream = request.body.pipeThrough(new TextDecoderStream());
        try {
          for await (const chunk of stream) {
            hooks.callHook("message", peer, new Message(chunk));
          }
        } catch {
          await stream.cancel().catch(() => {});
        }
        // eslint-disable-next-line unicorn/no-null
        return new Response(null, {});
      } else {
        // Add a new peer
        peer = new SSEPeer({
          peers,
          sse: {
            request,
            hooks,
            onClose: () => {
              peers.delete(peer);
              if (opts.bidir) {
                peersMap!.delete(peer.id);
              }
            },
          },
        });
        peers.add(peer);
        if (opts.bidir) {
          peersMap!.set(peer.id, peer);
          peer._sendEvent("crossws-id", peer.id);
        }
      }

      let headers: HeadersInit = {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      };
      if (opts.bidir) {
        headers["x-crossws-id"] = peer.id;
      }
      if (_res?.headers) {
        headers = new Headers(headers);
        for (const [key, value] of new Headers(_res.headers)) {
          headers.set(key, value);
        }
      }

      return new Response(peer._sseStream, { ..._res, headers });
    },
  };
});

// --- peer ---

class SSEPeer extends Peer<{
  peers: Set<SSEPeer>;
  sse: {
    request: Request;
    hooks: AdapterHookable;
    onClose: (peer: SSEPeer) => void;
  };
}> {
  _sseStream: ReadableStream;
  _sseStreamController?: ReadableStreamDefaultController;

  constructor(internal: SSEPeer["_internal"]) {
    super(internal);
    this._sseStream = new ReadableStream({
      start: (controller) => {
        this._sseStreamController = controller;
        this._internal.sse.hooks.callHook("open", this);
      },
      cancel: () => {
        this._internal.sse.onClose(this);
        this._internal.sse.hooks.callHook("close", this);
      },
    }).pipeThrough(new TextEncoderStream());
  }

  get url() {
    return this._internal.sse.request.url;
  }

  get headers() {
    return this._internal.sse.request.headers;
  }

  _sendEvent(event: string, data: string) {
    const lines = data.split("\n");
    this._sseStreamController?.enqueue(
      `event: ${event}\n${lines.map((l) => `data: ${l}`)}\n\n`,
    );
  }

  send(message: any) {
    this._sendEvent("message", toString(message));
    return 0;
  }

  publish(topic: string, message: any) {
    const data = toString(message);
    for (const peer of this._internal.peers) {
      if (peer !== this && peer._topics.has(topic)) {
        peer._sendEvent("message", data);
      }
    }
  }

  close() {
    this._sseStreamController?.close();
  }

  terminate() {
    this.close();
  }
}
