import type { AdapterOptions } from "./adapter.ts";
import type { WSError } from "./error.ts";
import type { Peer } from "./peer.ts";
import type { Message } from "./message.ts";

export class AdapterHookable {
  options: AdapterOptions;

  constructor(options?: AdapterOptions) {
    this.options = options || {};
  }

  callHook<N extends keyof Hooks>(
    name: N,
    arg1: Parameters<Hooks[N]>[0],
    arg2?: Parameters<Hooks[N]>[1],
  ): MaybePromise<ReturnType<Hooks[N]>> {
    // Call global hook first
    const globalHook = this.options.hooks?.[name];
    const globalPromise = globalHook?.(arg1 as any, arg2 as any);

    // Resolve hooks for request
    const resolveHooksPromise = this.options.resolve?.(arg1);
    if (!resolveHooksPromise) {
      return globalPromise as any; // Fast path: no hooks to resolve
    }
    const resolvePromise =
      resolveHooksPromise instanceof Promise
        ? resolveHooksPromise.then((hooks) => hooks?.[name])
        : resolveHooksPromise?.[name];

    // In parallel, call global hook and resolve hook implementation
    return Promise.all([globalPromise, resolvePromise]).then(
      ([globalRes, hook]) => {
        const hookResPromise = hook?.(arg1 as any, arg2 as any);
        return hookResPromise instanceof Promise
          ? hookResPromise.then((hookRes) => hookRes || globalRes)
          : hookResPromise || globalRes;
      },
    ) as Promise<any>;
  }

  callAdapterHook<N extends keyof AdapterHooks>(
    name: N,
    ...args: Parameters<AdapterHooks[N]>
  ): ReturnType<AdapterHooks[N]> {
    return this.options.adapterHooks?.[name]?.apply(undefined, args);
  }
}

// --- types ---

export function defineHooks<T extends Partial<Hooks> = Partial<Hooks>>(
  hooks: T,
): T {
  return hooks;
}

export type ResolveHooks = (
  info: RequestInit | Peer,
) => Partial<Hooks> | Promise<Partial<Hooks>>;

export type MaybePromise<T> = T | Promise<T>;

type HookFn<ArgsT extends any[] = any, RT = void> = (
  info: Peer,
  ...args: ArgsT
) => MaybePromise<RT>;

export interface Hooks {
  /** Upgrading */
  upgrade: (
    request:
      | Request
      | {
          url: string;
          headers: Headers;
        },
  ) => MaybePromise<Response | ResponseInit | void>;

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
