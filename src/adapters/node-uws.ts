// https://github.com/websockets/ws
// https://github.com/websockets/ws/blob/master/doc/ws.md

import type {
  WebSocketBehavior,
  WebSocket,
  HttpRequest,
  HttpResponse,
} from "uWebSockets.js";
import { WebSocketPeerBase } from "../peer";
import { WebSocketMessage } from "../message";
import { defineWebSocketAdapter } from "../adapter";
import { CrossWSOptions, createCrossWS } from "../crossws";

type UserData = {
  _peer?: any;
  req: HttpRequest;
  res: HttpResponse;
  context: any;
};

type WebSocketHandler = WebSocketBehavior<UserData>;

export interface AdapterOptions extends CrossWSOptions {
  uws?: Exclude<
    WebSocketBehavior<any>,
    | "close"
    | "drain"
    | "message"
    | "open"
    | "ping"
    | "pong"
    | "subscription"
    | "upgrade"
  >;
}

export interface Adapter {
  websocket: WebSocketHandler;
}

export default defineWebSocketAdapter<Adapter, AdapterOptions>(
  (hooks, options = {}) => {
    const crossws = createCrossWS(hooks, options);

    const getPeer = (ws: WebSocket<UserData>) => {
      const userData = ws.getUserData();
      if (userData._peer) {
        return userData._peer as WebSocketPeer;
      }
      const peer = new WebSocketPeer({ uws: { ws, userData } });
      userData._peer = peer;
      return peer;
    };

    const websocket: WebSocketHandler = {
      ...options.uws,
      close(ws, code, message) {
        const peer = getPeer(ws);
        crossws.$("uws:close", peer, ws, code, message);
        hooks.close?.(peer, { code, reason: message?.toString() });
      },
      drain(ws) {
        const peer = getPeer(ws);
        crossws.$("uws:drain", peer, ws);
      },
      message(ws, message, isBinary) {
        const peer = getPeer(ws);
        crossws.$("uws:message", peer, ws, message, isBinary);
        const msg = new WebSocketMessage(message, isBinary);
        hooks.message?.(peer, msg);
      },
      open(ws) {
        const peer = getPeer(ws);
        crossws.$("uws:open", peer, ws);
        hooks.open?.(peer);
      },
      ping(ws, message) {
        const peer = getPeer(ws);
        crossws.$("uws:ping", peer, ws, message);
      },
      pong(ws, message) {
        const peer = getPeer(ws);
        crossws.$("uws:pong", peer, ws, message);
      },
      subscription(ws, topic, newCount, oldCount) {
        const peer = getPeer(ws);
        crossws.$("uws:subscription", peer, ws, topic, newCount, oldCount);
      },
      // error ? TODO
      upgrade(res, req, context) {
        /* This immediately calls open handler, you must not use res after this call */
        res.upgrade(
          {
            req,
            res,
            context,
          },
          req.getHeader("sec-websocket-key"),
          req.getHeader("sec-websocket-protocol"),
          req.getHeader("sec-websocket-extensions"),
          context,
        );
      },
    };

    return {
      websocket,
    };
  },
);

class WebSocketPeer extends WebSocketPeerBase<{
  uws: {
    ws: WebSocket<UserData>;
    userData: UserData;
  };
}> {
  _headers: Headers | undefined;

  get id() {
    try {
      const addr = this.ctx.uws.ws?.getRemoteAddressAsText();
      return new TextDecoder().decode(addr);
    } catch {
      // Error: Invalid access of closed uWS.WebSocket/SSLWebSocket.
    }
  }

  // TODO
  // get readyState() {}

  get url() {
    return this.ctx.uws.userData.req.getUrl();
  }

  get headers() {
    if (!this._headers) {
      const headers = new Headers();
      // eslint-disable-next-line unicorn/no-array-for-each
      this.ctx.uws.userData.req.forEach((key, value) => {
        headers.set(key, value);
      });
      this._headers = headers;
    }
    return this._headers;
  }

  send(message: string, compress?: boolean) {
    this.ctx.uws.ws.send(message, false, compress);
    return 0;
  }
}
