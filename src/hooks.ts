import { WebSocketError } from "./error";
import type { WebSocketMessage } from "./message";
import type { WebSocketPeerBase } from "./peer";

type WSHook<ArgsT extends Array<any> = []> = (
  peer: WebSocketPeerBase,
  ...args: ArgsT
) => void | Promise<void>;

export function defineWebSocketHooks(
  hooks: Partial<WebSocketHooks>,
): Partial<WebSocketHooks> {
  return hooks;
}

export interface WebSocketHooks {
  /** A message is received */
  message: WSHook<[WebSocketMessage]>;

  /** A socket is opened */
  open: WSHook<[]>;

  /** A socket is closed */
  close: WSHook<[{ code?: number; reason?: string }]>;

  /** An error occurs */
  error: WSHook<[WebSocketError]>;

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

  // Node
  "node:open": WSHook<[]>;
  "node:message": WSHook<[data: any, isBinary: boolean]>;
  "node:close": WSHook<[code: number, reason: Buffer]>;
  "node:error": WSHook<[error: any]>;
  "node:ping": WSHook<[data: Buffer]>;
  "node:pong": WSHook<[data: Buffer]>;
  "node:unexpected-response": WSHook<[req: any, res: any]>;
  "node:upgrade": WSHook<[req: any]>;
}
