import {
  CrossWSOptions,
  WebSocketAdapter,
  defineWebSocketHooks,
} from "../src/index.ts";

export const getIndexHTML = () =>
  fetch(
    "https://raw.githubusercontent.com/unjs/crossws/main/examples/h3/public/index.html",
  ).then((res) => res.text());

export function createDemo<T extends WebSocketAdapter>(
  adapter: T,
  opts?: Parameters<T>[1],
): ReturnType<T> {
  const hooks = defineWebSocketHooks({
    $(name, peer, ...args) {
      console.log(
        `$ ${peer} ${name} (${args.map((arg) => stringify(arg)).join(", ")})`,
      );
    },
    open(peer) {
      peer.send("Welcome to the server!");
      peer.subscribe("welcome");
      peer.publish("welcome", `New user joined! ${peer}`);
    },
    message(peer, message) {
      if (message.text() === "ping") {
        peer.send("pong");
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

  const resolve: CrossWSOptions["resolve"] = (info) => {
    return {
      open: (peer) => {
        peer.send({
          url: info.url,
          headers:
            info.headers && Object.fromEntries(new Headers(info.headers)),
        });
      },
    };
  };

  return adapter(hooks, {
    resolve,
    ...opts,
  });
}

function stringify(val) {
  const str = val.toString();
  if (str === "[object Object]") {
    return val.constructor?.name || "??";
  }
  return str;
}
