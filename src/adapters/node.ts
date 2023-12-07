// https://github.com/websockets/ws
// https://github.com/websockets/ws/blob/master/doc/ws.md

import type { ClientRequest, IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import {
  WebSocketServer as _WebSocketServer,
  WebSocket as _WebSocket,
} from "ws";
import type {
  ServerOptions,
  RawData,
  WebSocketServer,
  WebSocket as WebSocketT,
} from "../../types/ws";
import { WebSocketPeer } from "../peer";
import { WebSocketMessage } from "../message";
import { WebSocketError } from "../error";
import { defineWebSocketAdapter } from "../adapter";

export const WebSocket = _WebSocket as unknown as WebSocketT;

export interface AdapterOptions {
  wss?: WebSocketServer;
  serverOptions?: ServerOptions;
}

export interface Adapter {
  handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): void;
}

export default defineWebSocketAdapter<Adapter, AdapterOptions>(
  (handler, opts = {}) => {
    const wss: WebSocketServer =
      opts.wss ||
      (new _WebSocketServer({
        noServer: true,
        ...(opts.serverOptions as any),
      }) as WebSocketServer);

    // Unmanaged server-level events
    wss.on("error", (error) => {
      handler.onEvent?.("node:server-error", error);
    });
    wss.on("headers", (headers, request) => {
      handler.onEvent?.("node:server-headers", headers, request);
    });
    wss.on("listening", () => {
      handler.onEvent?.("node:server-listening");
    });
    wss.on("close", () => {
      handler.onEvent?.("node:server-close");
    });

    wss.on("connection", (ws, req) => {
      const peer = new NodeWebSocketPeer(ws, req);

      // Managed socket-level events
      ws.on("message", (data: RawData, isBinary: boolean) => {
        handler.onEvent?.("node:message", ws, data, isBinary);
        if (Array.isArray(data)) {
          data = Buffer.concat(data);
        }
        handler.onMessage?.(peer, new WebSocketMessage(data, isBinary));
      });
      ws.on("error", (error: Error) => {
        handler.onEvent?.("node:error", ws, error);
        handler.onError?.(peer, new WebSocketError(error));
      });
      ws.on("close", (code: number, reason: Buffer) => {
        handler.onEvent?.("node:close", ws, code, reason);
        handler.onClose?.(peer, code, reason?.toString());
      });
      ws.on("open", () => {
        handler.onEvent?.("node:open", ws);
        handler.onOpen?.(peer);
      });

      // Unmanaged socket-level events
      ws.on("ping", (data: Buffer) => {
        handler.onEvent?.("node:ping", ws, data);
      });
      ws.on("pong", (data: Buffer) => {
        handler.onEvent?.("node:pong", ws, data);
      });
      ws.on(
        "unexpected-response",
        (request: ClientRequest, response: IncomingMessage) => {
          handler.onEvent?.("node:unexpected-response", ws, request, response);
        },
      );
      ws.on("upgrade", (request: IncomingMessage) => {
        handler.onEvent?.("node:upgrade", ws, request);
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

class NodeWebSocketPeer extends WebSocketPeer {
  constructor(
    private _ws: WebSocketT,
    private _req: IncomingMessage,
  ) {
    super();
  }

  get id() {
    const socket = this._req?.socket;
    if (!socket) {
      return undefined;
    }
    const addr =
      socket.remoteFamily === "IPv6"
        ? `[${socket.remoteAddress}]`
        : socket.remoteAddress;
    return `${addr}:${socket.remotePort}`;
  }

  get readyState() {
    return this._ws.readyState;
  }

  send(message: string, compress?: boolean) {
    this._ws.send(message, { compress });
    return 0;
  }
}
