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
import { WSPeer } from "../peer";
import { WSMessage } from "../message";
import { WebSocketError } from "../error";
import { defineWebSocketAdapter } from "../adapter";
import { CrossWSOptions, createCrossWS } from "../crossws";
import { toBufferLike } from "../_utils";

export interface AdapterOptions extends CrossWSOptions {
  wss?: WebSocketServer;
  serverOptions?: ServerOptions;
}

export interface Adapter {
  handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): void;
}

export default defineWebSocketAdapter<Adapter, AdapterOptions>(
  (hooks, options = {}) => {
    const crossws = createCrossWS(hooks, options);

    const wss: WebSocketServer =
      options.wss ||
      (new _WebSocketServer({
        noServer: true,
        ...(options.serverOptions as any),
      }) as WebSocketServer);

    wss.on("connection", (ws, req) => {
      const peer = new NodeWSPeer({ node: { ws, req, server: wss } });
      crossws.open(peer);

      // Managed socket-level events
      ws.on("message", (data: RawData, isBinary: boolean) => {
        crossws.$("node:message", peer, data, isBinary);
        if (Array.isArray(data)) {
          data = Buffer.concat(data);
        }
        crossws.message(peer, new WSMessage(data, isBinary));
      });
      ws.on("error", (error: Error) => {
        crossws.$("node:error", peer, error);
        crossws.error(peer, new WebSocketError(error));
      });
      ws.on("close", (code: number, reason: Buffer) => {
        crossws.$("node:close", peer, code, reason);
        crossws.close(peer, {
          code,
          reason: reason?.toString(),
        });
      });
      ws.on("open", () => {
        crossws.$("node:open", peer);
      });

      // Unmanaged socket-level events
      ws.on("ping", (data: Buffer) => {
        crossws.$("node:ping", peer, data);
      });
      ws.on("pong", (data: Buffer) => {
        crossws.$("node:pong", peer, data);
      });
      ws.on(
        "unexpected-response",
        (req: ClientRequest, res: IncomingMessage) => {
          crossws.$("node:unexpected-response", peer, req, res);
        },
      );
      ws.on("upgrade", (req: IncomingMessage) => {
        crossws.$("node:upgrade", peer, req);
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

class NodeWSPeer extends WSPeer<{
  node: {
    server: WebSocketServer;
    req: IncomingMessage;
    ws: WebSocketT;
  };
}> {
  get id() {
    const socket = this.ctx.node.req.socket;
    if (!socket) {
      return undefined;
    }
    const addr =
      socket.remoteFamily === "IPv6"
        ? `[${socket.remoteAddress}]`
        : socket.remoteAddress;
    return `${addr}:${socket.remotePort}`;
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
