import { Peer } from "./peer";
import type {
  AdapterOptions,
  Caller,
  Hooks,
  CrossWS,
  WSRequest,
} from "./types";

export function createCrossWS(opts: AdapterOptions = {}): CrossWS {
  const resolveHook = async <K extends keyof Hooks>(
    req: Peer | WSRequest,
    name: K,
  ) => {
    const hooks = await opts.resolve?.(req);
    return hooks?.[name] as Hooks[K] | undefined;
  };

  return {
    // WS Hooks
    async callHook(name, ...args) {
      await opts.hooks?.[name]?.apply(undefined, args);
      const hook = await resolveHook(args[0], name);
      await hook?.apply(undefined, args); // eslint-disable-line prefer-spread
    },
    // Upgrade
    async upgrade(req) {
      const [res1, res2] = await Promise.all([
        opts.hooks?.upgrade?.(req),
        await resolveHook(req, "upgrade").then((h) => h?.(req)),
      ]);
      const headers = new Headers(res1?.headers);
      if (res2?.headers) {
        for (const [key, value] of new Headers(res2?.headers)) {
          headers.append(key, value);
        }
      }
      return { headers };
    },
    // Adapter hook
    $callHook(name, ...args) {
      return opts.adapterHooks?.[name]?.apply(undefined, args);
    },
  };
}
