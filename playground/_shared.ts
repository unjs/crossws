import { ResolveHooks, Adapter, defineHooks } from "../src/index.ts";

export const getIndexHTML = () =>
  fetch(
    "https://raw.githubusercontent.com/unjs/crossws/main/examples/h3/public/index.html",
  ).then((res) => res.text());

export function createDemo<T extends Adapter<any, any>>(
  adapter: T,
  options?: Parameters<T>[0],
): ReturnType<T> {
  const hooks = defineHooks({
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

  const resolve: ResolveHooks = (info) => {
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

  return adapter({
    ...options,
    hooks,
    resolve,
  });
}

function stringify(val) {
  const str = val.toString();
  if (str === "[object Object]") {
    return val.constructor?.name || "??";
  }
  return str;
}
