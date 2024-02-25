import { WSError } from "./error";
import type { Message } from "./message";
import type { Peer } from "./peer";

// --- Utils ---

type MaybePromise<T> = T | Promise<T>;

export type Caller<
  T extends Record<string, (...args: any[]) => Promise<any>>,
  RT = null,
> = <K extends keyof T>(
  key: K,
  ...args: Parameters<T[K]>
) => RT extends null ? Promise<ReturnType<T[K]>> : RT;

// --- Adapter ---

export interface AdapterOptions {
  resolve?: ResolveHooks;
  hooks?: Hooks;
  adapterHooks?: AdapterHooks;
}

export type Adapter<AdapterT, Options extends AdapterOptions> = (
  options?: Options,
) => AdapterT;

export function defineWebSocketAdapter<
  AdapterT,
  Options extends AdapterOptions = AdapterOptions,
>(factory: Adapter<AdapterT, Options>) {
  return factory;
}

// --- CrossWS ---

export interface CrossWS {
  $callHook: Caller<AdapterHooks>;
  callHook: Caller<Exclude<Hooks, "upgrade">, void>;
  upgrade: (req: WSRequest) => Promise<{ headers?: HeadersInit }>;
}

// --- Request ---

export interface WSRequest {
  readonly url: string;
  readonly headers: HeadersInit;
}

// --- Hooks ---

export function defineHooks<T extends Partial<Hooks> = Partial<Hooks>>(
  hooks: T,
): T {
  return hooks;
}

export type ResolveHooks = (
  info: WSRequest | Peer,
) => Partial<Hooks> | Promise<Partial<Hooks>>;

type HookFn<ArgsT extends any[] = any, RT = void> = (
  info: Peer,
  ...args: ArgsT
) => MaybePromise<RT>;

export interface Hooks extends Record<string, HookFn<any[], any>> {
  /** Upgrading */
  upgrade: (req: WSRequest) => MaybePromise<void | { headers?: HeadersInit }>;

  /** A message is received */
  message: (peer: Peer, message: Message) => MaybePromise<void>;

  /** A socket is opened */
  open: (peer: Peer) => MaybePromise<void>;

  /** A socket is closed */
  close: (
    peer: Peer,
    details: { code?: number; reason?: string },
  ) => MaybePromise<void>;

  /** An error occurs */
  error: (peer: Peer, error: WSError) => MaybePromise<void>;
}

export interface AdapterHooks extends Record<string, HookFn<any[], any>> {
  // Bun
  "bun:message": HookFn<[ws: any, message: any]>;
  "bun:open": HookFn<[ws: any]>;
  "bun:close": HookFn<[ws: any]>;
  "bun:drain": HookFn<[]>;
  "bun:error": HookFn<[ws: any, error: any]>;
  "bun:ping": HookFn<[ws: any, data: any]>;
  "bun:pong": HookFn<[ws: any, data: any]>;

  // Cloudflare
  "cloudflare:accept": HookFn<[]>;
  "cloudflare:message": HookFn<[event: any]>;
  "cloudflare:error": HookFn<[event: any]>;
  "cloudflare:close": HookFn<[event: any]>;

  // Deno
  "deno:open": HookFn<[]>;
  "deno:message": HookFn<[event: any]>;
  "deno:close": HookFn<[]>;
  "deno:error": HookFn<[error: any]>;

  // ws (Node)
  "node:open": HookFn<[]>;
  "node:message": HookFn<[data: any, isBinary: boolean]>;
  "node:close": HookFn<[code: number, reason: Buffer]>;
  "node:error": HookFn<[error: any]>;
  "node:ping": HookFn<[data: Buffer]>;
  "node:pong": HookFn<[data: Buffer]>;
  "node:unexpected-response": HookFn<[req: any, res: any]>;
  "node:upgrade": HookFn<[req: any]>;

  // uws (Node)
  "uws:open": HookFn<[ws: any]>;
  "uws:message": HookFn<[ws: any, message: any, isBinary: boolean]>;
  "uws:close": HookFn<[ws: any, code: number, message: any]>;
  "uws:ping": HookFn<[ws: any, message: any]>;
  "uws:pong": HookFn<[ws: any, message: any]>;
  "uws:drain": HookFn<[ws: any]>;
  "uws:upgrade": HookFn<[res: any, req: any, context: any]>;
  "uws:subscription": HookFn<
    [ws: any, topic: any, newCount: number, oldCount: number]
  >;
}
