import type { WebSocketHooks, UserHooks } from "./hooks";
import { WSPeer, WSRequest } from "./peer";

export interface CrossWS extends WebSocketHooks {
  upgrade: (req: WSRequest) => Promise<{ headers: HeadersInit }>;
}

export interface CrossWSOptions {
  resolve?: (info: WSRequest | WSPeer) => UserHooks | Promise<UserHooks>;
}

export function createCrossWS(
  hooks: UserHooks,
  options: CrossWSOptions,
): CrossWS {
  const _callHook = options.resolve
    ? <WebSocketHooks["$"]>async function (name, info, ...args): Promise<any> {
        const hooks = await options.resolve?.(info);
        const hook = hooks?.[name];
        return hook?.(info as any, ...(args as [any]));
      }
    : undefined;

  return {
    async $(name, ...args) {
      await Promise.all([hooks.$?.(name, ...args), _callHook?.(name, ...args)]);
    },
    async upgrade(req) {
      const upgradeResults = await Promise.all([
        hooks.upgrade?.(req),
        _callHook?.("upgrade", req),
      ]);
      const headers: Record<string, string> = Object.create(null);
      for (const result of upgradeResults) {
        if (result?.headers) {
          Object.assign(headers, result.headers);
        }
      }
      return { headers };
    },
    async message(peer, message) {
      await Promise.all([
        hooks.message?.(peer, message),
        _callHook?.("message", peer, message),
      ]);
    },
    async open(peer) {
      await Promise.all([hooks.open?.(peer), _callHook?.("open", peer)]);
    },
    async close(peer, { code, reason }) {
      await Promise.all([
        hooks.close?.(peer, { code, reason }),
        _callHook?.("close", peer, { code, reason }),
      ]);
    },
    async error(peer, error) {
      await Promise.all([
        hooks.error?.(peer, error),
        _callHook?.("error", peer, error),
      ]);
    },
  };
}
