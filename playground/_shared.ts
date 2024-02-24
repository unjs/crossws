import {
  CrossWSOptions,
  WebSocketAdapter,
  defineWebSocketHooks,
} from "../src/index.ts";

export const getIndexHTML = (params) =>
  import("../examples/h3/index.html.ts").then((r) => r.html(params));

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
      peer.send(`Hello ${peer}`);
    },
    message(peer, message) {
      if (message.text() === "ping") {
        peer.send("pong");
      }
    },
  });

  const resolve: CrossWSOptions["resolve"] = (peer) => {
    return {
      open: () => {
        peer.send(
          JSON.stringify(
            {
              url: peer.url,
              headers: peer.headers && Object.fromEntries(peer.headers),
            },
            undefined,
            2,
          ),
        );
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
