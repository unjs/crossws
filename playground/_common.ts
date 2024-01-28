import { defineWebSocketHandler } from "../src";
import type { WebSocketAdapter } from "../src";

export const getIndexHTMLURL = () =>
  new URL("public/index.html", import.meta.url);

export const importIndexHTML = () =>
  import("./public/index.html" as string).then((r) => r.default);

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
    peer.send("hello!");
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
