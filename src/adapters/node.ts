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
import { createCrossWS } from "../crossws";
import { toBufferLike } from "../_utils";

export interface NodeAdapter {
  handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): void;
}

export interface NodeOptions extends AdapterOptions {
  wss?: WebSocketServer;
  serverOptions?: ServerOptions;
}

export default defineWebSocketAdapter<NodeAdapter, NodeOptions>(
  (options = {}) => {
    const crossws = createCrossWS(options);

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
        crossws.$callHook("node:message", peer, data, isBinary);
        if (Array.isArray(data)) {
          data = Buffer.concat(data);
        }
        crossws.callHook("message", peer, new Message(data, isBinary));
      });
      ws.on("error", (error: Error) => {
        crossws.$callHook("node:error", peer, error);
        crossws.callHook("error", peer, new WSError(error));
      });
      ws.on("close", (code: number, reason: Buffer) => {
        crossws.$callHook("node:close", peer, code, reason);
        crossws.callHook("close", peer, {
          code,
          reason: reason?.toString(),
        });
      });
      ws.on("open", () => {
        crossws.$callHook("node:open", peer);
      });

      // Unmanaged socket-level events
      ws.on("ping", (data: Buffer) => {
        crossws.$callHook("node:ping", peer, data);
      });
      ws.on("pong", (data: Buffer) => {
        crossws.$callHook("node:pong", peer, data);
      });
      ws.on(
        "unexpected-response",
        (req: ClientRequest, res: IncomingMessage) => {
          crossws.$callHook("node:unexpected-response", peer, req, res);
        },
      );
      ws.on("upgrade", (req: IncomingMessage) => {
        crossws.$callHook("node:upgrade", peer, req);
      });
    });

    wss.on("headers", function (outgoingHeaders, req) {
      const upgradeHeaders = (req as any)._upgradeHeaders as HeadersInit;
      if (upgradeHeaders) {
        const _headers = new Headers(upgradeHeaders);
        for (const [key, value] of _headers) {
          outgoingHeaders.push(`${key}: ${value}`);
        }
      }
    });

    return {
      handleUpgrade: async (req, socket, head) => {
        const { headers } = await crossws.upgrade({
          url: req.url || "",
          headers: req.headers as HeadersInit,
        });
        (req as any)._upgradeHeaders = headers;
        wss.handleUpgrade(req, socket, head, (ws) => {
          wss.emit("connection", ws, req);
        });
      },
    };
  },
);

class NodePeer extends Peer<{
  node: {
    server: WebSocketServer;
    req: IncomingMessage;
    ws: WebSocketT;
  };
}> {
  get addr() {
    const socket = this.ctx.node.req.socket;
    if (!socket) {
      return undefined;
    }
    const headers = this.ctx.node.req.headers;
    let addr = headers["x-forwarded-for"] || socket.remoteAddress || "??";
    if (addr.includes(":")) {
      addr = `[${addr}]`;
    }
    const port = headers["x-forwarded-port"] || socket.remotePort || "??";
    return `${addr}:${port}`;
  }

  get url() {
    return this.ctx.node.req.url || "/";
  }

  get headers() {
    return this.ctx.node.req.headers as HeadersInit;
  }

  get readyState() {
    return this.ctx.node.ws.readyState;
  }

  send(message: any, options?: { compress?: boolean; binary?: boolean }) {
    this.ctx.node.ws.send(toBufferLike(message), {
      compress: options?.compress,
      binary: options?.binary,
      ...options,
    });
    return 0;
  }
}
