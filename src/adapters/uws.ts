// https://github.com/websockets/ws
// https://github.com/websockets/ws/blob/master/doc/ws.md

import type {
  WebSocketBehavior,
  WebSocket,
  HttpRequest,
  HttpResponse,
  RecognizedString,
} from "uWebSockets.js";
import { Peer } from "../peer";
import { Message } from "../message";
import { AdapterOptions, defineWebSocketAdapter } from "../types";
import { CrossWS } from "../crossws";
import { toBufferLike } from "../_utils";

type UserData = {
  _peer?: any;
  req: HttpRequest;
  res: HttpResponse;
  context: any;
};

type WebSocketHandler = WebSocketBehavior<UserData>;

export interface UWSAdapter {
  websocket: WebSocketHandler;
}

export interface UWSOptions extends AdapterOptions {
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

export default defineWebSocketAdapter<UWSAdapter, UWSOptions>(
  (options = {}) => {
    const crossws = new CrossWS(options);
    return {
      websocket: {
        ...options.uws,
        close(ws, code, message) {
          const peer = getPeer(ws);
          crossws.callAdapterHook("uws:close", peer, ws, code, message);
          crossws.callHook("close", peer, {
            code,
            reason: message?.toString(),
          });
        },
        drain(ws) {
          const peer = getPeer(ws);
          crossws.callAdapterHook("uws:drain", peer, ws);
        },
        message(ws, message, isBinary) {
          const peer = getPeer(ws);
          crossws.callAdapterHook("uws:message", peer, ws, message, isBinary);
          const msg = new Message(message, isBinary);
          crossws.callHook("message", peer, msg);
        },
        open(ws) {
          const peer = getPeer(ws);
          crossws.callAdapterHook("uws:open", peer, ws);
          crossws.callHook("open", peer);
        },
        ping(ws, message) {
          const peer = getPeer(ws);
          crossws.callAdapterHook("uws:ping", peer, ws, message);
        },
        pong(ws, message) {
          const peer = getPeer(ws);
          crossws.callAdapterHook("uws:pong", peer, ws, message);
        },
        subscription(ws, topic, newCount, oldCount) {
          const peer = getPeer(ws);
          crossws.callAdapterHook(
            "uws:subscription",
            peer,
            ws,
            topic,
            newCount,
            oldCount,
          );
        },
        async upgrade(res, req, context) {
          let aborted = false;
          res.onAborted(() => {
            aborted = true;
          });
          const _res = await crossws.callHook("upgrade", new UWSReqProxy(req));
          if (aborted) {
            return;
          }
          if (_res instanceof Response) {
            res.writeStatus(`${_res.status} ${_res.statusText}`);
            for (const [key, value] of _res.headers) {
              res.writeHeader(key, value);
            }
            const bytes = await _res.bytes();
            if (!aborted) {
              res.end(bytes);
            }
            return;
          }
          res.writeStatus("101 Switching Protocols");
          if (_res?.headers) {
            for (const [key, value] of new Headers(_res.headers)) {
              res.writeHeader(key, value);
            }
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
      },
    };
  },
);

class UWSReqProxy {
  private _headers?: Headers;
  private _rawHeaders: [string, string][] = [];
  url: string;
  constructor(private _req: HttpRequest) {
    this.url = _req.getUrl();
    // eslint-disable-next-line unicorn/no-array-for-each
    this._req.forEach((key, value) => {
      this._rawHeaders.push([key, value]);
    });
  }
  get headers(): Headers {
    if (!this._headers) {
      this._headers = new Headers(this._rawHeaders);
    }
    return this._headers;
  }
}

function getPeer(ws: WebSocket<UserData>) {
  const userData = ws.getUserData();
  if (userData._peer) {
    return userData._peer as Peer;
  }
  const peer = new UWSPeer({ uws: { ws, userData } });
  userData._peer = peer;
  return peer;
}

class UWSPeer extends Peer<{
  uws: {
    ws: WebSocket<UserData>;
    userData: UserData;
  };
}> {
  _decoder = new TextDecoder();
  _req: UWSReqProxy;

  constructor(ctx: UWSPeer["ctx"]) {
    super(ctx);
    this._req = new UWSReqProxy(ctx.uws.userData.req);
  }

  get addr() {
    try {
      const addr = this._decoder.decode(
        this.ctx.uws.ws?.getRemoteAddressAsText(),
      );
      return addr.replace(/(0000:)+/, "");
    } catch {
      // Error: Invalid access of closed uWS.WebSocket/SSLWebSocket.
    }
  }

  get url() {
    return this._req.url;
  }

  get headers() {
    return this._req.headers;
  }

  send(message: any, options?: { compress?: boolean }) {
    const data = toBufferLike(message);
    const isBinary = typeof data !== "string";
    return this.ctx.uws.ws.send(data, isBinary, options?.compress);
  }

  subscribe(topic: string): void {
    this.ctx.uws.ws.subscribe(topic);
  }

  publish(topic: string, message: string, options?: { compress?: boolean }) {
    const data = toBufferLike(message);
    const isBinary = typeof data !== "string";
    this.ctx.uws.ws.publish(topic, data, isBinary, options?.compress);
    return 0;
  }

  close(code?: number, reason?: RecognizedString) {
    this.ctx.uws.ws.end(code, reason);
  }

  terminate(): void {
    this.ctx.uws.ws.close();
  }
}
