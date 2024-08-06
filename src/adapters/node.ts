// https://github.com/websockets/ws
// https://github.com/websockets/ws/blob/master/doc/ws.md

import type { ClientRequest, IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer as _WebSocketServer } from "ws";
import type {
  ServerOptions,
  RawData,
  WebSocketServer,
  WebSocket as WebSocketT,
} from "../../types/ws";
import { Peer } from "../peer";
import { Message } from "../message";
import { WSError } from "../error";
import {
  AdapterOptions,
  AdapterInstance,
  defineWebSocketAdapter,
} from "../types";
import { AdapterHookable } from "../hooks";
import { toBufferLike } from "../_utils";

type AugmentedReq = IncomingMessage & { _upgradeHeaders?: HeadersInit };

export interface NodeAdapter extends AdapterInstance {
  handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): void;
  closeAll: (code?: number, data?: string | Buffer) => void;
}

export interface NodeOptions extends AdapterOptions {
  wss?: WebSocketServer;
  serverOptions?: ServerOptions;
}

export default defineWebSocketAdapter<NodeAdapter, NodeOptions>(
  (options = {}) => {
    const hooks = new AdapterHookable(options);
    const peers = new Set<NodePeer>();

    const wss: WebSocketServer =
      options.wss ||
      (new _WebSocketServer({
        noServer: true,
        ...(options.serverOptions as any),
      }) as WebSocketServer);

    wss.on("connection", (ws, req) => {
      const peer = new NodePeer({ peers, node: { ws, req, server: wss } });
      peers.add(peer);
      hooks.callHook("open", peer);

      // Managed socket-level events
      ws.on("message", (data: RawData, isBinary: boolean) => {
        hooks.callAdapterHook("node:message", peer, data, isBinary);
        if (Array.isArray(data)) {
          data = Buffer.concat(data);
        }
        hooks.callHook("message", peer, new Message(data, isBinary));
      });
      ws.on("error", (error: Error) => {
        peers.delete(peer);
        hooks.callAdapterHook("node:error", peer, error);
        hooks.callHook("error", peer, new WSError(error));
      });
      ws.on("close", (code: number, reason: Buffer) => {
        peers.delete(peer);
        hooks.callAdapterHook("node:close", peer, code, reason);
        hooks.callHook("close", peer, {
          code,
          reason: reason?.toString(),
        });
      });
      ws.on("open", () => {
        hooks.callAdapterHook("node:open", peer);
      });

      // Unmanaged socket-level events
      ws.on("ping", (data: Buffer) => {
        hooks.callAdapterHook("node:ping", peer, data);
      });
      ws.on("pong", (data: Buffer) => {
        hooks.callAdapterHook("node:pong", peer, data);
      });
      ws.on(
        "unexpected-response",
        (req: ClientRequest, res: IncomingMessage) => {
          hooks.callAdapterHook("node:unexpected-response", peer, req, res);
        },
      );
      ws.on("upgrade", (req: IncomingMessage) => {
        hooks.callAdapterHook("node:upgrade", peer, req);
      });
    });

    wss.on("headers", function (outgoingHeaders, req) {
      const upgradeHeaders = (req as AugmentedReq)._upgradeHeaders;
      if (upgradeHeaders) {
        for (const [key, value] of new Headers(upgradeHeaders)) {
          outgoingHeaders.push(`${key}: ${value}`);
        }
      }
    });

    return {
      get peers() {
        return peers;
      },
      handleUpgrade: async (req, socket, head) => {
        const res = await hooks.callHook("upgrade", new NodeReqProxy(req));
        if (res instanceof Response) {
          return sendResponse(socket, res);
        }
        (req as AugmentedReq)._upgradeHeaders = res?.headers;
        wss.handleUpgrade(req, socket, head, (ws) => {
          wss.emit("connection", ws, req);
        });
      },
      closeAll: (code, data) => {
        for (const client of wss.clients) {
          client.close(code, data);
        }
      },
    };
  },
);

class NodeReqProxy {
  _req: IncomingMessage;
  _headers?: Headers;
  _url?: string;

  constructor(req: IncomingMessage) {
    this._req = req;
  }

  get url(): string {
    if (!this._url) {
      const req = this._req;
      const host = req.headers["host"] || "localhost";
      const isSecure =
        (req.socket as any)?.encrypted ??
        req.headers["x-forwarded-proto"] === "https";
      this._url = `${isSecure ? "https" : "http"}://${host}${req.url}`;
    }
    return this._url;
  }

  get headers(): Headers {
    if (!this._headers) {
      this._headers = new Headers(this._req.headers as HeadersInit);
    }
    return this._headers;
  }
}

async function sendResponse(socket: Duplex, res: Response) {
  const head = [
    `HTTP/1.1 ${res.status || 200} ${res.statusText || ""}`,
    ...[...res.headers.entries()].map(
      ([key, value]) =>
        `${encodeURIComponent(key)}: ${encodeURIComponent(value)}`,
    ),
  ];
  socket.write(head.join("\r\n") + "\r\n\r\n");
  if (res.body) {
    for await (const chunk of res.body) {
      socket.write(chunk);
    }
  }
  return new Promise<void>((resolve) => {
    socket.end(resolve);
  });
}

class NodePeer extends Peer<{
  peers: Set<NodePeer>;
  node: {
    server: WebSocketServer;
    req: IncomingMessage;
    ws: WebSocketT & { _peer?: NodePeer };
  };
}> {
  _req: NodeReqProxy;
  constructor(ctx: NodePeer["_internal"]) {
    super(ctx);
    this._req = new NodeReqProxy(ctx.node.req);
    ctx.node.ws._peer = this;
  }

  get addr() {
    const socket = this._internal.node.req.socket;
    if (!socket) {
      return undefined;
    }
    const headers = this._internal.node.req.headers;
    let addr = headers["x-forwarded-for"] || socket.remoteAddress || "??";
    if (addr.includes(":")) {
      addr = `[${addr}]`;
    }
    const port = headers["x-forwarded-port"] || socket.remotePort || "??";
    return `${addr}:${port}`;
  }

  get url() {
    return this._req.url;
  }

  get headers() {
    return this._req.headers;
  }

  get readyState() {
    return this._internal.node.ws.readyState;
  }

  send(message: any, options?: { compress?: boolean }) {
    const data = toBufferLike(message);
    const isBinary = typeof data !== "string";
    this._internal.node.ws.send(data, {
      compress: options?.compress,
      binary: isBinary,
      ...options,
    });
    return 0;
  }

  publish(topic: string, message: any, options?: { compress?: boolean }): void {
    const data = toBufferLike(message);
    const isBinary = typeof data !== "string";
    const sendOptions = {
      compress: options?.compress,
      binary: isBinary,
      ...options,
    };
    for (const peer of this._internal.peers) {
      if (peer !== this && peer._topics.has(topic)) {
        peer._internal.node.ws.send(data, sendOptions);
      }
    }
  }

  close(code?: number, data?: string | Buffer) {
    this._internal.node.ws.close(code, data);
  }

  terminate() {
    this._internal.node.ws.terminate();
  }
}
