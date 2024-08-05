import { ResolveHooks, Adapter, defineHooks } from "../../src/index.ts";

export const getIndexHTML = () =>
  import("./_index.html.ts").then((r) => r.default);

export function createDemo<T extends Adapter<any, any>>(
  adapter: T,
  options?: Parameters<T>[0],
): ReturnType<T> {
  const hooks = defineHooks({
    open(peer) {
      peer.send(`Welcome to the server ${peer}!`);
      peer.subscribe("chat");
      peer.publish("chat", `${peer} joined!`);
    },
    message(peer, message) {
      const msgText = message.text();
      switch (msgText) {
        case "ping": {
          peer.send("pong");
          break;
        }
        case "binary": {
          peer.send(new TextEncoder().encode("binary message works!"));
          break;
        }
        case "debug": {
          peer.send({
            id: peer.id,
            ip: peer.addr,
            url: peer.url,
            headers: Object.fromEntries(peer.headers || []),
          });
          break;
        }
        default: {
          peer.send(msgText);
          peer.publish("chat", msgText);
        }
      }
    },
    upgrade(req) {
      return {
        headers: {
          "x-powered-by": "cross-ws",
          "set-cookie": "cross-ws=1; SameSite=None; Secure",
        },
      };
    },
  });

  return adapter({
    ...options,
    hooks,
  });
}
