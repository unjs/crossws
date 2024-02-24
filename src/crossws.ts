import type { WebSocketHooks, AdapterHooks, UserHooks } from "./hooks";

export interface CrossWSOptions {}

type AdapterHook = <NAME extends keyof AdapterHooks>(
  name: NAME,
  ...args: Parameters<AdapterHooks[NAME]>
) => ReturnType<AdapterHooks[NAME]>;

export interface CrossWS extends WebSocketHooks {
  $: AdapterHook;
}

export function createCrossWS(
  _hooks: UserHooks,
  options: CrossWSOptions,
): CrossWS {
  return {
    // @ts-expect-error TODO
    $(name, ...args) {
      // @ts-expect-error TODO
      return _hooks[name]?.(...args);
    },
    message(peer, message) {
      return _hooks.message?.(peer, message);
    },
    open(peer) {
      return _hooks.open?.(peer);
    },
    close(peer, { code, reason }) {
      return _hooks.close?.(peer, { code, reason });
    },
    error(peer, error) {
      return _hooks.error?.(peer, error);
    },
  };
}
