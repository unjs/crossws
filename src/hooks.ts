import { WebSocketError } from "./error";
import type { WSMessage } from "./message";
import type { WSPeer, WSRequest } from "./peer";

type MaybePromise<T> = T | Promise<T>;

export type _UserHooks = WebSocketHooks & AdapterHooks;
export type UserHooks = Partial<_UserHooks>;

export function defineWebSocketHooks<T extends UserHooks = UserHooks>(
  hooks: T,
): T {
  return hooks;
}

type UserHookName = Exclude<keyof _UserHooks, "$">;

type CatchAllHandler = <Name extends UserHookName>(
  name: Name,
  ...args: Parameters<_UserHooks[Name]>
) => MaybePromise<void>;

export interface WebSocketHooks {
  /** Catch-all handler */
  $: CatchAllHandler;

  /** Upgrading */
  upgrade: (req: WSRequest) => MaybePromise<void | { headers?: HeadersInit }>;

  /** A message is received */
  message: (peer: WSPeer, message: WSMessage) => MaybePromise<void>;

  /** A socket is opened */
  open: (peer: WSPeer) => MaybePromise<void>;

  /** A socket is closed */
  close: (
    peer: WSPeer,
    details: { code?: number; reason?: string },
  ) => MaybePromise<void>;

  /** An error occurs */
  error: (peer: WSPeer, error: WebSocketError) => MaybePromise<void>;
}

type WSHook<ArgsT extends Array<any> = []> = (
  peer: WSPeer,
  ...args: ArgsT
) => MaybePromise<void>;

export interface AdapterHooks {
  // Bun
  "bun:message": WSHook<[ws: any, message: any]>;
  "bun:open": WSHook<[ws: any]>;
  "bun:close": WSHook<[ws: any]>;
  "bun:drain": WSHook<[]>;
  "bun:error": WSHook<[ws: any, error: any]>;
  "bun:ping": WSHook<[ws: any, data: any]>;
  "bun:pong": WSHook<[ws: any, data: any]>;

  // Cloudflare
  "cloudflare:accept": WSHook<[]>;
  "cloudflare:message": WSHook<[event: any]>;
  "cloudflare:error": WSHook<[event: any]>;
  "cloudflare:close": WSHook<[event: any]>;

  // Deno
  "deno:open": WSHook<[]>;
  "deno:message": WSHook<[event: any]>;
  "deno:close": WSHook<[]>;
  "deno:error": WSHook<[error: any]>;

  // ws (Node)
  "node:open": WSHook<[]>;
  "node:message": WSHook<[data: any, isBinary: boolean]>;
  "node:close": WSHook<[code: number, reason: Buffer]>;
  "node:error": WSHook<[error: any]>;
  "node:ping": WSHook<[data: Buffer]>;
  "node:pong": WSHook<[data: Buffer]>;
  "node:unexpected-response": WSHook<[req: any, res: any]>;
  "node:upgrade": WSHook<[req: any]>;

  // uws (Node)
  "uws:open": WSHook<[ws: any]>;
  "uws:message": WSHook<[ws: any, message: any, isBinary: boolean]>;
  "uws:close": WSHook<[ws: any, code: number, message: any]>;
  "uws:ping": WSHook<[ws: any, message: any]>;
  "uws:pong": WSHook<[ws: any, message: any]>;
  "uws:drain": WSHook<[ws: any]>;
  "uws:upgrade": WSHook<[res: any, req: any, context: any]>;
  "uws:subscription": WSHook<
    [ws: any, topic: any, newCount: number, oldCount: number]
  >;
}
