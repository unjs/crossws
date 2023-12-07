import {
  defineWebSocketHandler,
  type WebSocketAdapter,
  type WebSocketHandler,
} from "../src";

export const indexHTMLURL = new URL("_index.html", import.meta.url);

export const log = (arg0: string, ...args) =>
  console.log(`[ws] [${arg0}]`, ...args);

const websocketHandler = defineWebSocketHandler({
  onMessage: (peer, message) => {
    log("message", peer, message);
    if (message.text().includes("ping")) {
      peer.send("pong");
    }
  },
  onError: (peer, error) => {
    log("error", peer, error);
  },
  onOpen: (peer) => {
    log("open", peer);
  },
  onClose: (peer, code, reason) => {
    log("close", peer, code, reason);
  },
  onEvent: (event, ...args) => {
    log("event", event);
  },
});

export function createDemo<T extends WebSocketAdapter>(
  adapter: T,
  opts?: Parameters<T>[1],
): ReturnType<T> {
  return adapter(websocketHandler, opts);
}
