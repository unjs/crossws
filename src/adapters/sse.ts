// https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events

import { WebSocketServer as _WebSocketServer } from "ws";
import { Peer } from "../peer";
import {
  AdapterOptions,
  AdapterInstance,
  defineWebSocketAdapter,
} from "../types";
import { AdapterHookable } from "../hooks";
import { adapterUtils, toBufferLike } from "../_utils";

export interface SSEAdapter extends AdapterInstance {
  fetch(req: Request): Promise<Response>;
}

export interface SSEOptions extends AdapterOptions {}

export default defineWebSocketAdapter<SSEAdapter, SSEOptions>(
  (options = {}) => {
    const hooks = new AdapterHookable(options);
    const peers = new Set<SSEPeer>();

    return {
      ...adapterUtils(peers),
      fetch: async (request: Request) => {
        const _res = await hooks.callHook("upgrade", request);
        if (_res instanceof Response) {
          return _res;
        }

        const peer = new SSEPeer({ peers, sse: { request, hooks } });

        let headers: HeadersInit = {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        };
        if (_res?.headers) {
          headers = new Headers(headers);
          for (const [key, value] of new Headers(_res.headers)) {
            headers.set(key, value);
          }
        }

        return new Response(peer._sseStream, { ..._res, headers });
      },
    };
  },
);

class SSEPeer extends Peer<{
  peers: Set<SSEPeer>;
  sse: {
    request: Request;
    hooks: AdapterHookable;
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
        this._internal.sse.hooks.callHook("close", this);
      },
    });
  }

  get url() {
    return this._internal.sse.request.url;
  }

  get headers() {
    return this._internal.sse.request.headers;
  }

  send(message: any) {
    let data = toBufferLike(message);
    if (typeof data !== "string") {
      // eslint-disable-next-line unicorn/prefer-code-point
      data = btoa(String.fromCharCode(...new Uint8Array(data)));
    }
    this._sseStreamController?.enqueue(`event: message\ndata: ${data}\n\n`);
    return 0;
  }

  publish(topic: string, message: any) {
    const data = toBufferLike(message);
    for (const peer of this._internal.peers) {
      if (peer !== this && peer._topics.has(topic)) {
        peer._sseStreamController?.enqueue(data);
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
