// https://github.com/websockets/ws
// https://github.com/websockets/ws/blob/master/doc/ws.md

import { WebSocketBehavior, WebSocket } from "uWebSockets.js";
import { WebSocketPeerBase } from "../peer";
import { WebSocketMessage } from "../message";
import { defineWebSocketAdapter } from "../adapter";

type UserData = { _peer?: any };
type WebSocketHandler = WebSocketBehavior<UserData>;

export interface AdapterOptions
  extends Exclude<
    WebSocketBehavior<any>,
    | "close"
    | "drain"
    | "message"
    | "open"
    | "ping"
    | "pong"
    | "subscription"
    | "upgrade"
  > {}

export interface Adapter {
  websocket: WebSocketHandler;
}

export default defineWebSocketAdapter<Adapter, AdapterOptions>(
  (hooks, opts = {}) => {
    const getPeer = (ws: WebSocket<UserData>) => {
      const userData = ws.getUserData();
      if (userData._peer) {
        return userData._peer as WebSocketPeer;
      }
      const peer = new WebSocketPeer({ uws: { ws } });
      userData._peer = peer;
      return peer;
    };

    const websocket: WebSocketHandler = {
      ...opts,
      close(ws, code, message) {
        const peer = getPeer(ws);
        hooks["uws:close"]?.(peer, ws, code, message);
        hooks.close?.(peer, { code, reason: message?.toString() });
      },
      drain(ws) {
        const peer = getPeer(ws);
        hooks["uws:drain"]?.(peer, ws);
      },
      message(ws, message, isBinary) {
        const peer = getPeer(ws);
        hooks["uws:message"]?.(peer, ws, message, isBinary);
        const msg = new WebSocketMessage(message, isBinary);
        hooks.message?.(peer, msg);
      },
      open(ws) {
        const peer = getPeer(ws);
        hooks["uws:open"]?.(peer, ws);
        hooks.open?.(peer);
      },
      ping(ws, message) {
        const peer = getPeer(ws);
        hooks["uws:ping"]?.(peer, ws, message);
      },
      pong(ws, message) {
        const peer = getPeer(ws);
        hooks["uws:pong"]?.(peer, ws, message);
      },
      subscription(ws, topic, newCount, oldCount) {
        const peer = getPeer(ws);
        hooks["uws:subscription"]?.(peer, ws, topic, newCount, oldCount);
      },
      // error ? TODO
      // upgrade(res, req, context) {}
    };

    return {
      websocket,
    };
  },
);

class WebSocketPeer extends WebSocketPeerBase<{
  uws: {
    ws: WebSocket<UserData>;
  };
}> {
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

  send(message: string, compress?: boolean) {
    this.ctx.uws.ws.send(message, false, compress);
    return 0;
  }
}
