import { serve as srvxServe } from "srvx/bun";
import adapter from "../adapters/bun";
import { defaultResolve } from "./_resolve";

import type { Server, ServerPlugin, ServerOptions } from "srvx";
import type { WSOptions, ServerWithWSOptions } from "./_types";

export function plugin(wsOpts: WSOptions): ServerPlugin {
  return (server) => {
    const ws = adapter({
      hooks: wsOpts,
      resolve: defaultResolve(server, wsOpts),
      ...wsOpts.options?.bun,
    });

    server.options.middleware.unshift((req, next) => {
      if (req.headers.get("upgrade")?.toLowerCase() === "websocket") {
        return ws.handleUpgrade(
          req,
          // srvx models the Bun server with its own structural `BunHttpServer`
          // type, which is narrower than Bun's own `Server`.
          req.runtime!.bun!.server as unknown as Parameters<typeof ws.handleUpgrade>[1],
        ) as Promise<Response>;
      }
      return next();
    });

    server.options.bun ??= {};
    if (server.options.bun.websocket) {
      throw new Error("websocket handlers for bun already set!");
    }
    server.options.bun.websocket = ws.websocket;
  };
}

export function serve(options: ServerWithWSOptions): Server {
  if (options.websocket) {
    options.plugins ||= [];
    options.plugins.push(plugin(options.websocket));
  }
  return srvxServe(options as ServerOptions);
}
