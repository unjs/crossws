import type { AdapterOptions, AdapterInstance } from "../adapter.ts";
import type { WebSocket } from "../../types/web.ts";
import type uws from "uWebSockets.js";
import { toBufferLike } from "../utils.ts";
import { defineWebSocketAdapter, adapterUtils } from "../adapter.ts";
import { AdapterHookable, formatRejection, Reasons } from "../hooks.ts";
import { Message } from "../message.ts";
import { Peer } from "../peer.ts";

// --- types ---

type UserData = {
  peer?: UWSPeer;
  req: uws.HttpRequest;
  res: uws.HttpResponse;
  protocol: string;
  extensions: string;
};

type WebSocketHandler = uws.WebSocketBehavior<UserData>;

export interface UWSAdapter extends AdapterInstance {
  websocket: WebSocketHandler;
}

export interface UWSOptions extends AdapterOptions {
  uws?: Exclude<
    uws.WebSocketBehavior<any>,
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

// --- adapter ---

// https://github.com/websockets/ws
// https://github.com/websockets/ws/blob/master/doc/ws.md
export default defineWebSocketAdapter<UWSAdapter, UWSOptions>(
  (options = {}) => {
    const hooks = new AdapterHookable(options);
    const peers = new Set<UWSPeer>();
    return {
      ...adapterUtils(peers),
      websocket: {
        ...options.uws,
        close(ws, code, message) {
          const peer = getPeer(ws, peers);
          ((peer as any)._internal.ws as UwsWebSocketProxy).readyState =
            2 /* CLOSING */;
          peers.delete(peer);
          hooks.callHook("close", peer, {
            code,
            reason: message?.toString(),
          });
          ((peer as any)._internal.ws as UwsWebSocketProxy).readyState =
            3 /* CLOSED */;
        },
        message(ws, message, isBinary) {
          const peer = getPeer(ws, peers);
          hooks.callHook("message", peer, new Message(message, peer));
        },
        open(ws) {
          const peer = getPeer(ws, peers);
          peers.add(peer);
          hooks.callHook("open", peer);
        },
        async upgrade(res, req, context) {
          let aborted = false;
          res.onAborted(() => {
            aborted = true;
          });

          /** Accept the Websocket upgrade request. */
          async function accept(params?: { headers?: HeadersInit }): Promise<void> {
            if (aborted) {
              return;
            }
            res.writeStatus("101 Switching Protocols");
            if (params?.headers) {
              for (const [key, value] of new Headers(params.headers)) {
                res.writeHeader(key, value);
              }
            }

            res.cork(() => {
              const key = req.getHeader("sec-websocket-key");
              const protocol = req.getHeader("sec-websocket-protocol");
              const extensions = req.getHeader("sec-websocket-extensions");
              res.upgrade(
                {
                  req,
                  res,
                  protocol,
                  extensions,
                },
                key,
                protocol,
                extensions,
                context,
              );
            });
          }

          async function reject(reason: Reasons): Promise<void> {
            const formatedRejection = formatRejection({ reason, type: "Response" })
            res.writeStatus(`${formatedRejection.status} ${formatedRejection.statusText}`);
            for (const [key, value] of formatedRejection.headers) {
              res.writeHeader(key, value);
            }
            if (formatedRejection.body) {
              for await (const chunk of formatedRejection.body) {
                if (aborted) {
                  break;
                }
                res.write(chunk);
              }
            }
            if (!aborted) {
              res.end();
            }
            return;
          }

          await hooks.callHook("upgrade", new UWSReqProxy(req),
            {
              accept,
              reject
            }
          );
        },
      },
    };
  },
);

// --- peer ---

function getPeer(uws: uws.WebSocket<UserData>, peers: Set<UWSPeer>): UWSPeer {
  const uwsData = uws.getUserData();
  if (uwsData.peer) {
    return uwsData.peer;
  }
  const peer = new UWSPeer({
    peers,
    uws,
    ws: new UwsWebSocketProxy(uws),
    request: new UWSReqProxy(uwsData.req),
    uwsData,
  });
  uwsData.peer = peer;
  return peer;
}

class UWSPeer extends Peer<{
  peers: Set<UWSPeer>;
  request: UWSReqProxy;
  uws: uws.WebSocket<UserData>;
  ws: UwsWebSocketProxy;
  uwsData: UserData;
}> {
  get remoteAddress() {
    try {
      const addr = new TextDecoder().decode(
        this._internal.uws.getRemoteAddressAsText(),
      );
      return addr;
    } catch {
      // Error: Invalid access of closed uWS.WebSocket/SSLWebSocket.
    }
  }

  send(data: unknown, options?: { compress?: boolean }) {
    const dataBuff = toBufferLike(data);
    const isBinary = typeof data !== "string";
    return this._internal.uws.send(dataBuff, isBinary, options?.compress);
  }

  subscribe(topic: string): void {
    this._internal.uws.subscribe(topic);
  }

  publish(topic: string, message: string, options?: { compress?: boolean }) {
    const data = toBufferLike(message);
    const isBinary = typeof data !== "string";
    this._internal.uws.publish(topic, data, isBinary, options?.compress);
    return 0;
  }

  close(code?: number, reason?: uws.RecognizedString) {
    this._internal.uws.end(code, reason);
  }

  terminate(): void {
    this._internal.uws.close();
  }
}

// --- web compat ---

class UWSReqProxy {
  private _headers?: Headers;
  private _rawHeaders: [string, string][] = [];

  url: string;

  constructor(_req: uws.HttpRequest) {
    // Headers
    let host = "localhost";
    let proto = "http";
    // eslint-disable-next-line unicorn/no-array-for-each
    _req.forEach((key, value) => {
      if (key === "host") {
        host = value;
      } else if (key === "x-forwarded-proto" && value === "https") {
        proto = "https";
      }
      this._rawHeaders.push([key, value]);
    });
    // URL
    const query = _req.getQuery();
    const pathname = _req.getUrl();
    this.url = `${proto}://${host}${pathname}${query ? `?${query}` : ""}`;
  }

  get headers(): Headers {
    if (!this._headers) {
      this._headers = new Headers(this._rawHeaders);
    }
    return this._headers;
  }
}

class UwsWebSocketProxy implements Partial<WebSocket> {
  readyState?: number = 1 /* OPEN */;

  constructor(private _uws: uws.WebSocket<UserData>) { }

  get bufferedAmount() {
    return this._uws?.getBufferedAmount();
  }

  get protocol() {
    return this._uws?.getUserData().protocol;
  }

  get extensions() {
    return this._uws?.getUserData().extensions;
  }
}
