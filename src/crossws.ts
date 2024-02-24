import type { WebSocketHooks, AdapterHooks, UserHooks } from "./hooks";
import { WebSocketPeer } from "./peer";

export interface CrossWS extends WebSocketHooks {}

export interface CrossWSOptions {
  resolve?: (
    peer: WebSocketPeer,
  ) => UserHooks | void | Promise<UserHooks | void>;
}

export function createCrossWS(
  _hooks: UserHooks,
  options: CrossWSOptions,
): CrossWS {
  const _callHook = options.resolve
    ? async (name: keyof UserHooks, peer: WebSocketPeer, ...args: any[]) => {
        const hooks = await options.resolve?.(peer);
        // @ts-expect-error
        return hooks?.[name]?.(peer, ...args);
      }
    : undefined;

  return {
    $(name, peer, ...args) {
      _hooks.$?.(name, peer, ...args);
      _callHook?.(name, peer, ...args);
    },
    message(peer, message) {
      _hooks.message?.(peer, message);
      _callHook?.("message", peer, message);
    },
    open(peer) {
      _hooks.open?.(peer);
      _callHook?.("open", peer);
    },
    close(peer, { code, reason }) {
      _hooks.close?.(peer, { code, reason });
      _callHook?.("close", peer, { code, reason });
    },
    error(peer, error) {
      _hooks.error?.(peer, error);
      _callHook?.("error", peer, error);
    },
  };
}
