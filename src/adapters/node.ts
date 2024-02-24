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
import { WebSocketPeerBase } from "../peer";
import { WebSocketMessage } from "../message";
import { WebSocketError } from "../error";
import { defineWebSocketAdapter } from "../adapter";
import { CrossWSOptions, createCrossWS } from "../crossws";

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

    // Unmanaged server-level events
    wss.on("error", (error) => {
      crossws.$("node:server-error", error);
    });
    wss.on("headers", (headers, request) => {
      crossws.$("node:server-headers", headers, request);
    });
    wss.on("listening", () => {
      crossws.$("node:server-listening");
    });
    wss.on("close", () => {
      crossws.$("node:server-close");
    });

    wss.on("connection", (ws, req) => {
      const peer = new NodeWebSocketPeer({ node: { ws, req, server: wss } });
      hooks.open?.(peer);

      // Managed socket-level events
      ws.on("message", (data: RawData, isBinary: boolean) => {
        crossws.$("node:message", peer, data, isBinary);
        if (Array.isArray(data)) {
          data = Buffer.concat(data);
        }
        hooks.message?.(peer, new WebSocketMessage(data, isBinary));
      });
      ws.on("error", (error: Error) => {
        crossws.$("node:error", peer, error);
        hooks.error?.(peer, new WebSocketError(error));
      });
      ws.on("close", (code: number, reason: Buffer) => {
        crossws.$("node:close", peer, code, reason);
        hooks.close?.(peer, {
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

    return {
      handleUpgrade: (req, socket, head) => {
        wss.handleUpgrade(req, socket, head, (ws) => {
          wss.emit("connection", ws, req);
        });
      },
    };
  },
);

class NodeWebSocketPeer extends WebSocketPeerBase<{
  node: {
    server: WebSocketServer;
    req: IncomingMessage;
    ws: WebSocketT;
  };
}> {
  _headers: Headers | undefined;

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
    if (!this._headers) {
      this._headers = new Headers();
      for (const [key, value] of Object.entries(this.ctx.node.req.headers)) {
        if (typeof value === "string") {
          this._headers.append(key, value);
        } else if (Array.isArray(value)) {
          for (const v of value) {
            this._headers.append(key, v);
          }
        } // else value is undefined
      }
    }
    return this._headers;
  }

  get readyState() {
    return this.ctx.node.ws.readyState;
  }

  send(message: string, compress?: boolean) {
    this.ctx.node.ws.send(message, { compress });
    return 0;
  }
}
