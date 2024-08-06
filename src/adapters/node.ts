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
import { AdapterOptions, defineWebSocketAdapter } from "../types";
import { CrossWS } from "../crossws";
import { toBufferLike } from "../_utils";

type AugmentedReq = IncomingMessage & { _upgradeHeaders?: HeadersInit };

export interface NodeAdapter {
  handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): void;
  closeAll: (code?: number, data?: string | Buffer) => void;
}

export interface NodeOptions extends AdapterOptions {
  wss?: WebSocketServer;
  serverOptions?: ServerOptions;
}

export default defineWebSocketAdapter<NodeAdapter, NodeOptions>(
  (options = {}) => {
    const crossws = new CrossWS(options);

    const wss: WebSocketServer =
      options.wss ||
      (new _WebSocketServer({
        noServer: true,
        ...(options.serverOptions as any),
      }) as WebSocketServer);

    wss.on("connection", (ws, req) => {
      const peer = new NodePeer({ node: { ws, req, server: wss } });
      crossws.callHook("open", peer);

      // Managed socket-level events
      ws.on("message", (data: RawData, isBinary: boolean) => {
        crossws.callAdapterHook("node:message", peer, data, isBinary);
        if (Array.isArray(data)) {
          data = Buffer.concat(data);
        }
        crossws.callHook("message", peer, new Message(data, isBinary));
      });
      ws.on("error", (error: Error) => {
        crossws.callAdapterHook("node:error", peer, error);
        crossws.callHook("error", peer, new WSError(error));
      });
      ws.on("close", (code: number, reason: Buffer) => {
        crossws.callAdapterHook("node:close", peer, code, reason);
        crossws.callHook("close", peer, {
          code,
          reason: reason?.toString(),
        });
      });
      ws.on("open", () => {
        crossws.callAdapterHook("node:open", peer);
      });

      // Unmanaged socket-level events
      ws.on("ping", (data: Buffer) => {
        crossws.callAdapterHook("node:ping", peer, data);
      });
      ws.on("pong", (data: Buffer) => {
        crossws.callAdapterHook("node:pong", peer, data);
      });
      ws.on(
        "unexpected-response",
        (req: ClientRequest, res: IncomingMessage) => {
          crossws.callAdapterHook("node:unexpected-response", peer, req, res);
        },
      );
      ws.on("upgrade", (req: IncomingMessage) => {
        crossws.callAdapterHook("node:upgrade", peer, req);
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
      handleUpgrade: async (req, socket, head) => {
        const res = await crossws.callHook("upgrade", new NodeReqProxy(req));
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
    for (const client of this._internal.node.server.clients) {
      const peer = (client as WebSocketT & { _peer?: NodePeer })._peer;
      if (peer && peer !== this && peer._topics.has(topic)) {
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
