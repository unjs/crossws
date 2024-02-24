// https://github.com/websockets/ws
// https://github.com/websockets/ws/blob/master/doc/ws.md

import type {
  WebSocketBehavior,
  WebSocket,
  HttpRequest,
  HttpResponse,
} from "uWebSockets.js";
import { WSPeer } from "../peer";
import { WSMessage } from "../message";
import { defineWebSocketAdapter } from "../adapter";
import { CrossWSOptions, createCrossWS } from "../crossws";
import { toBufferLike } from "../_utils";

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

    const getWSPeer = (ws: WebSocket<UserData>) => {
      const userData = ws.getUserData();
      if (userData._peer) {
        return userData._peer as WSPeer;
      }
      const peer = new UWSWSPeer({ uws: { ws, userData } });
      userData._peer = peer;
      return peer;
    };

    const websocket: WebSocketHandler = {
      ...options.uws,
      close(ws, code, message) {
        const peer = getWSPeer(ws);
        crossws.$("uws:close", peer, ws, code, message);
        crossws.close(peer, { code, reason: message?.toString() });
      },
      drain(ws) {
        const peer = getWSPeer(ws);
        crossws.$("uws:drain", peer, ws);
      },
      message(ws, message, isBinary) {
        const peer = getWSPeer(ws);
        crossws.$("uws:message", peer, ws, message, isBinary);
        const msg = new WSMessage(message, isBinary);
        crossws.message(peer, msg);
      },
      open(ws) {
        const peer = getWSPeer(ws);
        crossws.$("uws:open", peer, ws);
        crossws.open(peer);
      },
      ping(ws, message) {
        const peer = getWSPeer(ws);
        crossws.$("uws:ping", peer, ws, message);
      },
      pong(ws, message) {
        const peer = getWSPeer(ws);
        crossws.$("uws:pong", peer, ws, message);
      },
      subscription(ws, topic, newCount, oldCount) {
        const peer = getWSPeer(ws);
        crossws.$("uws:subscription", peer, ws, topic, newCount, oldCount);
      },
      async upgrade(res, req, context) {
        let aborted = false;
        res.onAborted(() => {
          aborted = true;
        });

        const { headers } = await crossws.upgrade({
          get url() {
            return req.getUrl();
          },
          get headers() {
            return _getHeaders(req);
          },
        });
        res.writeStatus("101 Switching Protocols");
        for (const [key, value] of new Headers(headers)) {
          res.writeHeader(key, value);
        }

        if (aborted) {
          return;
        }

        res.cork(() => {
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
        });
      },
    };

    return {
      websocket,
    };
  },
);

class UWSWSPeer extends WSPeer<{
  uws: {
    ws: WebSocket<UserData>;
    userData: UserData;
  };
}> {
  _headers: HeadersInit | undefined;
  _decoder = new TextDecoder();

  get id() {
    try {
      const addr = this._decoder.decode(
        this.ctx.uws.ws?.getRemoteAddressAsText(),
      );
      return addr.replace(/(0000:)+/, "");
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
      this._headers = _getHeaders(this.ctx.uws.userData.req);
    }
    return this._headers;
  }

  send(message: any, options?: { compress?: boolean; binary?: boolean }) {
    return this.ctx.uws.ws.send(
      toBufferLike(message),
      options?.binary,
      options?.compress,
    );
  }

  subscribe(topic: string): void {
    this.ctx.uws.ws.subscribe(topic);
  }

  publish(
    topic: string,
    message: string,
    options?: { compress?: boolean; binary?: boolean },
  ) {
    this.ctx.uws.ws.publish(topic, message, options?.binary, options?.compress);
    return 0;
  }
}

function _getHeaders(req: HttpRequest): HeadersInit {
  const headers: [string, string][] = [];
  // eslint-disable-next-line unicorn/no-array-for-each
  req.forEach((key, value) => {
    headers.push([key, value]);
  });
  return headers;
}
