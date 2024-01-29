import { createApp, createRouter, eventHandler } from "h3";
import { defineWebSocketHooks } from "crossws";

const router = createRouter();
export const app = createApp().use(router);

router.get(
  "/",
  eventHandler(() =>
    import("./index.html").then((r) => r.html({ name: "h3" })),
  ),
);

// Listhen automatically sets up ws integration!
export const websocket = defineWebSocketHooks({
  open(peer) {
    console.log("[ws] open", peer);
  },

  message(peer, message) {
    console.log("[ws] message", peer, message);
    if (message.text().includes("ping")) {
      peer.send("pong");
    }
  },

  close(peer, event) {
    console.log("[ws] close", peer, event);
  },

  error(peer, error) {
    console.log("[ws] error", peer, error);
  },
});
