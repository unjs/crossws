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

export const ReasonMap = {
  "BadRequest": {
    Response: 400,
    Socket: 1002 // Protocol Error
  },
  "InvalidData": {
    Response: 400,
    Socket: 1007 // Invalid Frame Payload Data
  },
  "Unauthorized": {
    Response: 401,
    Socket: 3000 // Unauthorized
  },
  "Forbidden": {
    Response: 403,
    Socket: 1008 // Policy Violation
  },
  "PayloadTooLarge": {
    Response: 413,
    Socket: 1009 // Message Too Big
  },
  "UnsupportedMediaType": {
    Response: 415,
    Socket: 1003 // Unsupported Data
  },
  "UpgradeRequired": {
    Response: 426,
    Socket: 1010 // Mandatory Extension
  },
  "BadGateway": {
    Response: 502,
    Socket: 1014 // Bad Gateway
  },
  "ServiceUnavailable": {
    Response: 503,
    Socket: 1012 // Service Restart
  },
  "TryAgainLater": {
    Response: 503,
    Socket: 1013 // Try Again Later
  },
  "TLSHandshake": {
    Response: 426,
    Socket: 1015 // TLS Handshake
  },
  "InternalError": {
    Response: 500,
    Socket: 1006 // Abnormal Closure
  },
  "ServerError": {
    Response: 500,
    Socket: 1011 // Internal Error
  },
};

export type Reasons = keyof typeof ReasonMap
type ResponseTypes = "Response" | "Event"
type RejectionResponses<T> = 
 T extends "Response" ? Response :
 T extends "Event" ? { code: number, data: string } :
 undefined

export function formatRejection<T extends ResponseTypes>({ reason , type }: { reason: Reasons, type: T }): RejectionResponses<T> {
  switch (type) {
    case "Response":
      return new Response(reason, { status: ReasonMap[reason].Response, statusText: reason }) as RejectionResponses<T>
    case "Event":
      return { code: ReasonMap[reason].Socket, data: reason } as RejectionResponses<T>
    default:
      return undefined as RejectionResponses<T>
  }
}

export interface Hooks {
  /** Upgrading */
  upgrade: (
    request:
      | Request
      | {
        url: string;
        headers: Headers;
      },
    socket: {
      accept: (params?: { headers?: HeadersInit }) => void,
      reject: (reason: Reasons) => void,
    },
  ) => MaybePromise<void | Response>;

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
