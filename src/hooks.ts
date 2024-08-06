import type {
  AdapterHooks,
  AdapterOptions,
  Hooks,
  MaybePromise,
} from "./types.ts";

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
