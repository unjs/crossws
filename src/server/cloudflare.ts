import { serve as srvxServe } from "srvx/cloudflare";
import adapter from "../adapters/cloudflare";
import { defaultResolve } from "./_resolve";

import type { Server, ServerPlugin, ServerOptions } from "srvx";
import type { WSOptions, ServerWithWSOptions } from "./_types";

export function plugin(wsOpts: WSOptions): ServerPlugin {
  return (server) => {
    const ws = adapter({
      hooks: wsOpts,
      resolve: defaultResolve(server, wsOpts),
      ...wsOpts.options?.cloudflare,
    });
    server.options.middleware.unshift((req, next) => {
      if (req.headers.get("upgrade")?.toLowerCase() === "websocket") {
        return ws.handleUpgrade(
          req,
          req.runtime!.cloudflare!.env,
          // srvx models the execution context with its own structural
          // `CloudflareExecutionContext` type, which is narrower than the
          // `ExecutionContext` of `@cloudflare/workers-types`.
          req.runtime!.cloudflare!.context as unknown as Parameters<typeof ws.handleUpgrade>[2],
        );
      }
      return next();
    });
  };
}

export function serve(options: ServerWithWSOptions): Server {
  if (options.websocket) {
    options.plugins ||= [];
    options.plugins.push(plugin(options.websocket));
  }
  return srvxServe(options as ServerOptions) as unknown as Server; // cloudflare fetch types are incompatible...
}
