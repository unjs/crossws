import type { WebSocketHooks, WebSocketAdapter } from "../src";

export const getIndexHTMLURL = () =>
  new URL("public/index.html", import.meta.url);

export const importIndexHTML = () =>
  import("./public/index.html" as string).then((r) => r.default);

export function createDemo<T extends WebSocketAdapter>(
  adapter: T,
  opts?: Parameters<T>[1],
): ReturnType<T> {
  const hooks = createWebSocketDebugHooks({
    open(peer) {
      peer.send("Hello!");
    },
    message(peer, message) {
      if (message.text() === "ping") {
        peer.send("pong");
      }
    },
  });

  return adapter(hooks, opts);
}

function createWebSocketDebugHooks(
  hooks: Partial<WebSocketHooks>,
): Partial<WebSocketHooks> {
  const createDebugHook =
    (name: keyof WebSocketHooks) =>
    (peer, ...args: any[]) => {
      console.log(
        `[ws] [${name}]`,
        peer,
        [...args].map((arg, i) => `\n - arg#${i} ${arg}`).join(""),
      );
      hooks[name]?.(peer, ...args);
    };

  return new Proxy(
    {},
    {
      get(_, prop) {
        return createDebugHook(prop as keyof WebSocketHooks);
      },
    },
  );
}
