import { ResolveHooks, Adapter, defineHooks } from "../src/index.ts";

export const getIndexHTML = () =>
  import("./_index.html.ts").then((r) => r.default);

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
      peer.send({ user: "system", message: `Welcome to the server ${peer}!` });
      peer.subscribe("chat");
      peer.publish("chat", { user: "system", message: `${peer} joined!` });
    },
    message(peer, message) {
      if (message.text() === "ping") {
        peer.send({ user: "system", message: "pong" });
      } else {
        const _message = {
          user: peer.toString(),
          message: message.text(),
        };
        peer.send(_message);
        peer.publish("chat", _message);
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
          message: {
            info: {
              url: info.url,
              headers:
                info.headers && Object.fromEntries(new Headers(info.headers)),
            },
          },
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
