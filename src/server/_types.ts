import type { Server, ServerPlugin, ServerOptions, ServerRequest } from "srvx";

import type { Hooks } from "../hooks";

import type { BunOptions } from "../adapters/bun";
import type { BunnyOptions } from "../adapters/bunny";
import type { DenoOptions } from "../adapters/deno";
import type { NodeOptions } from "../adapters/node";
import type { SSEOptions } from "../adapters/sse";
import type { CloudflareOptions } from "../adapters/cloudflare";

export type WSOptions = Partial<Hooks> & {
  /**
   * Resolve the WebSocket hooks for an incoming request.
   *
   * When omitted, hooks are resolved by calling the server's `fetch` handler
   * and reading the `crossws` property off the returned `Response`. Provide
   * `resolve` only to customize routing (e.g. resolve hooks without invoking
   * the app). The default is skipped when inline hooks are passed directly
   * (e.g. `ws({ message })`), which run with zero per-event overhead instead.
   */
  resolve?: (req: ServerRequest) => Partial<Hooks> | Promise<Partial<Hooks>>;
  options?: {
    bun?: BunOptions;
    bunny?: BunnyOptions;
    deno?: DenoOptions;
    node?: NodeOptions;
    sse?: SSEOptions;
    cloudflare?: CloudflareOptions;
  };
};

export type ServerWithWSOptions = ServerOptions & { websocket?: WSOptions };

export declare function plugin(options: WSOptions): ServerPlugin;

export declare function serve(options: ServerWithWSOptions): Server;
