import { once } from "node:events";
import { getRandomPort } from "get-port-please";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import WebSocket from "ws";
import { serve } from "../src/server/node.ts";
import { defaultResolve } from "../src/server/_resolve.ts";
import {
  AdapterHookable,
  getWebSocketHooks,
  kWebSocketHooks,
  setWebSocketHooks,
} from "../src/hooks.ts";
import { StubRequest } from "../src/_request.ts";
import type { Server } from "srvx";
import type { Hooks } from "../src/hooks.ts";
import type { Peer, PeerContext } from "../src/peer.ts";
import type { Message } from "../src/message.ts";
import type { WSOptions } from "../src/server/_types.ts";

type ServeReturn = ReturnType<typeof serve>;

let currentServer: ServeReturn | undefined;
let unhandled: unknown[] = [];

function onUnhandled(err: unknown) {
  unhandled.push(err);
}

beforeEach(() => {
  unhandled = [];
  process.on("unhandledRejection", onUnhandled);
  process.on("uncaughtException", onUnhandled);
});

afterEach(async () => {
  process.off("unhandledRejection", onUnhandled);
  process.off("uncaughtException", onUnhandled);
  await currentServer?.close(true);
  currentServer = undefined;
  await new Promise((r) => setImmediate(r));
  if (unhandled.length > 0) {
    throw new AggregateError(
      unhandled as Error[],
      `Unexpected unhandled errors during test: ${unhandled
        .map((e) => (e as Error)?.message ?? String(e))
        .join("; ")}`,
    );
  }
});

// A fetch handler that mirrors the srvx/h3 convention: WebSocket hooks are
// attached to the returned Response as a non-standard `.crossws` property.
function fetchWithCrossws(hooks: Partial<Hooks>): (req: Request) => Response {
  return () => {
    const res = new Response("ok");
    (res as { crossws?: Partial<Hooks> }).crossws = hooks;
    return res;
  };
}

test("no resolve: hooks are resolved from the fetch handler's .crossws", async () => {
  const events: string[] = [];
  const port = await getRandomPort("localhost");
  const server = serve({
    port,
    hostname: "127.0.0.1",
    fetch: fetchWithCrossws({
      open() {
        events.push("open");
      },
      message(peer, message) {
        events.push(`message:${message.text()}`);
        peer.send(`echo:${message.text()}`);
      },
      close() {
        events.push("close");
      },
    }),
    websocket: {}, // <-- no resolve, no inline hooks
  });
  currentServer = server;
  await server.ready();

  const client = new WebSocket(`ws://127.0.0.1:${port}/`);
  await once(client, "open");
  client.send("hello");
  const [reply] = await once(client, "message");
  expect(reply.toString()).toBe("echo:hello");
  client.close();
  await once(client, "close");
  // Give the close hook a tick to fire.
  await new Promise((r) => setTimeout(r, 50));

  expect(events).toContain("open");
  expect(events).toContain("message:hello");
  expect(events).toContain("close");
});

test("explicit resolve takes precedence over the app fetch default", async () => {
  const events: string[] = [];
  const port = await getRandomPort("localhost");
  const server = serve({
    port,
    hostname: "127.0.0.1",
    // The app fetch attaches hooks that must NOT be used when resolve is given.
    fetch: fetchWithCrossws({
      message(peer) {
        peer.send("from-app-fetch");
      },
    }),
    websocket: {
      resolve: () => ({
        message(peer, message) {
          events.push(`resolved:${message.text()}`);
          peer.send(`resolved:${message.text()}`);
        },
      }),
    },
  });
  currentServer = server;
  await server.ready();

  const client = new WebSocket(`ws://127.0.0.1:${port}/`);
  await once(client, "open");
  client.send("hi");
  const [reply] = await once(client, "message");
  expect(reply.toString()).toBe("resolved:hi");
  expect(events).toEqual(["resolved:hi"]);
  client.close();
  await once(client, "close");
});

test("inline global hooks still work without a resolve or fetch .crossws", async () => {
  const events: string[] = [];
  const port = await getRandomPort("localhost");
  const server = serve({
    port,
    hostname: "127.0.0.1",
    // App fetch does NOT attach .crossws — inline hooks must handle everything.
    fetch: () => new Response("ok"),
    websocket: {
      open() {
        events.push("open");
      },
      message(peer, message) {
        peer.send(`inline:${message.text()}`);
      },
    },
  });
  currentServer = server;
  await server.ready();

  const client = new WebSocket(`ws://127.0.0.1:${port}/`);
  await once(client, "open");
  client.send("yo");
  const [reply] = await once(client, "message");
  expect(reply.toString()).toBe("inline:yo");
  expect(events).toContain("open");
  client.close();
  await once(client, "close");
});

test("app fetch may return a plain { crossws } object (no Response instance)", async () => {
  const port = await getRandomPort("localhost");
  const server = serve({
    port,
    hostname: "127.0.0.1",
    fetch: () => ({
      crossws: {
        message(peer, message) {
          peer.send(`echo:${message.text()}`);
        },
      },
    }),
    websocket: {}, // default resolver reads `.crossws` off the returned object
  });
  currentServer = server;
  await server.ready();

  const client = new WebSocket(`ws://127.0.0.1:${port}/`);
  await once(client, "open");
  client.send("hi");
  const [reply] = await once(client, "message");
  expect(reply.toString()).toBe("echo:hi");
  client.close();
  await once(client, "close");
});

test("app fetch may return { crossws, headers } to set handshake headers", async () => {
  const port = await getRandomPort("localhost");
  const server = serve({
    port,
    hostname: "127.0.0.1",
    fetch: () => ({
      crossws: {
        message(peer, message) {
          peer.send(message.text());
        },
      },
      headers: { "x-hello": "world" },
    }),
    websocket: {},
  });
  currentServer = server;
  await server.ready();

  const client = new WebSocket(`ws://127.0.0.1:${port}/`);
  // `ws` emits `upgrade` with the raw handshake response (an IncomingMessage).
  const [res] = (await once(client, "upgrade")) as [{ headers: Record<string, string> }];
  expect(res.headers["x-hello"]).toBe("world");
  client.close();
  await once(client, "close");
});

test("defaultResolve returns the explicit resolve unchanged", () => {
  const resolve: WSOptions["resolve"] = () => ({});
  const server = { options: { fetch: () => new Response("ok") } } as unknown as Server;
  expect(defaultResolve(server, { resolve })).toBe(resolve);
});

test("defaultResolve is skipped (undefined) when inline hooks are present", () => {
  const server = { options: { fetch: () => new Response("ok") } } as unknown as Server;
  expect(defaultResolve(server, { message() {} })).toBeUndefined();
});

test("defaultResolve reads .crossws off the fetch Response", async () => {
  const hooks: Partial<Hooks> = { message() {} };
  const server = {
    options: { fetch: fetchWithCrossws(hooks) },
  } as unknown as Server;
  const resolve = defaultResolve(server, {});
  expect(typeof resolve).toBe("function");
  const req = new Request("http://localhost/");
  await expect(resolve!(req as never)).resolves.toBe(hooks);
});

// `AdapterHookable.callHook` is the single code path EVERY runtime adapter
// (node/bun/deno/cloudflare/bunny/sse/uws) funnels its events through, so a
// resolver-invocation count asserted here holds for all providers. This is the
// core guarantee: `resolve` must not run per message.
test("cross-provider: resolve runs once per connection, not per message", async () => {
  let resolveCalls = 0;
  const hooks = new AdapterHookable({
    resolve: () => {
      resolveCalls++;
      return {
        open() {},
        message() {},
        close() {},
      };
    },
  });

  // One connection = one stable `peer.request` identity, reused across events.
  const request = new Request("http://localhost/");
  const peer = { request } as unknown as Peer;
  const msg = (text: string) => ({ text: () => text }) as unknown as Message;

  await hooks.callHook("open", peer);
  for (let i = 0; i < 20; i++) {
    await hooks.callHook("message", peer, msg(`m${i}`));
  }
  await hooks.callHook("close", peer, {});

  // 20 messages + open + close = 22 events, but resolve ran only once.
  expect(resolveCalls).toBe(1);

  // A second, distinct connection resolves independently (once).
  const peer2 = { request: new Request("http://localhost/other") } as unknown as Peer;
  await hooks.callHook("open", peer2);
  await hooks.callHook("message", peer2, msg("hi"));
  expect(resolveCalls).toBe(2);
});

test("cross-provider: upgrade + peer events share a single resolve via context", async () => {
  // Real adapters give the peer a *different* `request` object than the upgrade
  // request (e.g. deno snapshots it, node wraps a fresh proxy), so the upgrade
  // event and later peer events would resolve twice if keyed by request. They
  // are keyed by the shared `context` object instead — this asserts exactly one
  // resolve spans the whole connection.
  let resolveCalls = 0;
  const hooks = new AdapterHookable({
    resolve: () => {
      resolveCalls++;
      return { upgrade() {}, open() {}, message() {}, close() {} };
    },
  });
  const msg = (text: string) => ({ text: () => text }) as unknown as Message;

  // Upgrade seeds the cache against the returned `context`.
  const upgradeReq = new Request("http://localhost/") as Request & { context?: PeerContext };
  const { context } = await hooks.upgrade(upgradeReq);
  expect(resolveCalls).toBe(1);

  // Peer carries the SAME context but a DIFFERENT request object.
  const peer = {
    request: new Request("http://localhost/snapshot"),
    context,
  } as unknown as Peer;
  await hooks.callHook("open", peer);
  for (let i = 0; i < 10; i++) {
    await hooks.callHook("message", peer, msg(`m${i}`));
  }
  await hooks.callHook("close", peer, {});

  // Still one — the upgrade's resolve was reused for every peer event.
  expect(resolveCalls).toBe(1);
});

test("cross-provider: a rejected resolve is evicted so later events recover", async () => {
  // A transient `resolve` failure (e.g. the default resolver's `fetch` throwing
  // once) must not poison the whole connection — the cached rejection is evicted
  // so the next event retries.
  let calls = 0;
  const hooks = new AdapterHookable({
    resolve: () => {
      calls++;
      return calls === 1
        ? Promise.reject(new Error("transient"))
        : Promise.resolve({ message() {} });
    },
  });
  const peer = {
    request: new Request("http://localhost/"),
    context: {} as PeerContext,
  } as unknown as Peer;
  const msg = (text: string) => ({ text: () => text }) as unknown as Message;

  // First event: resolve rejects → this event rejects.
  await expect(hooks.callHook("message", peer, msg("a"))).rejects.toThrow("transient");
  // The failed cache entry is evicted, so the next event resolves afresh.
  await expect(hooks.callHook("message", peer, msg("b"))).resolves.toBeUndefined();
  expect(calls).toBe(2);
});

test("cross-provider: default fetch resolver is not invoked per message", async () => {
  let fetchCalls = 0;
  const port = await getRandomPort("localhost");
  const server = serve({
    port,
    hostname: "127.0.0.1",
    fetch: (req) => {
      fetchCalls++;
      return fetchWithCrossws({
        message(peer, message) {
          peer.send(`echo:${message.text()}`);
        },
      })(req);
    },
    websocket: {}, // default resolver
  });
  currentServer = server;
  await server.ready();

  const client = new WebSocket(`ws://127.0.0.1:${port}/`);
  await once(client, "open");

  // Drive many messages — none must trigger an additional fetch/resolve.
  for (let i = 0; i <= 20; i++) {
    client.send(`m${i}`);
    await once(client, "message");
  }

  // Exactly one fetch served the whole connection (the upgrade resolve, reused
  // for open + every message via the shared `context` key).
  expect(fetchCalls).toBe(1);

  client.close();
  await once(client, "close");
});

test("a non-ok app fetch Response is rendered (upgrade rejected)", async () => {
  // An app returning e.g. `new Response("Unauthorized", { status: 401 })` on the
  // upgrade path must fail the handshake and send that response, not silently
  // open a handler-less socket.
  const port = await getRandomPort("localhost");
  const server = serve({
    port,
    hostname: "127.0.0.1",
    fetch: () => new Response("Unauthorized", { status: 401 }),
    websocket: {}, // default resolver
  });
  currentServer = server;
  await server.ready();

  const client = new WebSocket(`ws://127.0.0.1:${port}/`);
  const [error] = await once(client, "error");
  expect((error as Error).message).toContain("401");
});

test("a synchronously throwing app fetch fails the handshake cleanly", async () => {
  // The default resolver calls the app `fetch` on upgrade. A fetch that throws
  // *synchronously* must not escape as an uncaught exception nor hang the
  // socket — the handshake should fail and the server stay up. (afterEach
  // asserts no unhandledRejection/uncaughtException leaked.)
  const port = await getRandomPort("localhost");
  const server = serve({
    port,
    hostname: "127.0.0.1",
    fetch: () => {
      throw new Error("boom");
    },
    websocket: {}, // default resolver → calls app fetch on upgrade
  });
  currentServer = server;
  await server.ready();

  const client = new WebSocket(`ws://127.0.0.1:${port}/`);
  const [error] = await once(client, "error");
  expect(error).toBeInstanceOf(Error);
});

test("a rejecting app fetch fails the handshake cleanly", async () => {
  const port = await getRandomPort("localhost");
  const server = serve({
    port,
    hostname: "127.0.0.1",
    fetch: () => Promise.reject(new Error("boom")),
    websocket: {}, // default resolver → calls app fetch on upgrade
  });
  currentServer = server;
  await server.ready();

  const client = new WebSocket(`ws://127.0.0.1:${port}/`);
  const [error] = await once(client, "error");
  expect(error).toBeInstanceOf(Error);
});

// --- request channel (`Symbol.for("crossws.hooks")`) ---
//
// Hooks attached to a `Response` are lost whenever a layer *rebuilds* it (a
// staged header, a wrapped stream, `new Response(res.body, res)` in any
// middleware) — a rebuilt response carries none of the original's own
// properties. The request is never replaced, so it is the durable channel.

// Simulates a framework that routes to a WebSocket handler (attaching hooks to
// the request) and whose response is then rebuilt by a middleware, dropping any
// hooks that were attached to it. This is the exact h3 + `routeRules({ headers })`
// regression.
function fetchWithRebuiltResponse(hooks: Partial<Hooks>, status = 426): (req: Request) => Response {
  return (req) => {
    setWebSocketHooks(req, hooks);
    const original = Object.assign(new Response("WebSocket upgrade is required.", { status }), {
      crossws: hooks,
    });
    // A middleware merging a staged header — `crossws` does not survive.
    return new Response(original.body, {
      status: original.status,
      headers: new Headers([...original.headers, ["x-test", "test"]]),
    });
  };
}

test("setWebSocketHooks/getWebSocketHooks round-trip via the registry symbol", () => {
  const hooks: Partial<Hooks> = { message() {} };
  const req = new Request("http://localhost/");
  setWebSocketHooks(req, hooks);
  // The symbol is the wire format: readable without importing the helpers.
  expect((req as never as Record<symbol, unknown>)[Symbol.for("crossws.hooks")]).toBe(hooks);
  expect(kWebSocketHooks).toBe(Symbol.for("crossws.hooks"));
  expect(getWebSocketHooks(req)).toBe(hooks);
});

test("setWebSocketHooks also writes the request `context` bag when present", () => {
  const hooks: Partial<Hooks> = { message() {} };
  const context: Record<symbol, unknown> = {};
  const req = Object.assign(new Request("http://localhost/"), { context });
  setWebSocketHooks(req, hooks);
  // Frameworks that derive a request internally propagate `context`, so hooks
  // written there survive the derivation.
  expect(context[kWebSocketHooks]).toBe(hooks);
  const derived = Object.assign(new Request("http://localhost/sub"), { context });
  expect(getWebSocketHooks(derived)).toBe(hooks);
});

test("setWebSocketHooks does not throw on a non-extensible request", () => {
  const hooks: Partial<Hooks> = { message() {} };
  // ESM is strict mode, so an unguarded assignment here would throw a
  // TypeError and take the whole upgrade down — worse than losing the hooks.
  const req = Object.preventExtensions(new Request("http://localhost/"));
  expect(() => setWebSocketHooks(req, hooks)).not.toThrow();
  expect(getWebSocketHooks(req)).toBeUndefined();
});

test("defaultResolve recovers hooks from the request when the response was rebuilt", async () => {
  const hooks: Partial<Hooks> = { message() {} };
  const server = {
    options: { fetch: fetchWithRebuiltResponse(hooks) },
  } as unknown as Server;
  const resolve = defaultResolve(server, {});
  const req = new Request("http://localhost/");
  await expect(resolve!(req as never)).resolves.toBe(hooks);
});

test("hooks on the request survive a rebuilt response end-to-end", async () => {
  const port = await getRandomPort("localhost");
  const server = serve({
    port,
    hostname: "127.0.0.1",
    fetch: fetchWithRebuiltResponse({
      message(peer, message) {
        peer.send(`echo:${message.text()}`);
      },
    }),
    websocket: {}, // default resolver
  });
  currentServer = server;
  await server.ready();

  const client = new WebSocket(`ws://127.0.0.1:${port}/`);
  await once(client, "open");
  client.send("hello");
  const [reply] = await once(client, "message");
  expect(reply.toString()).toBe("echo:hello");
  client.close();
  await once(client, "close");
});

test("response-attached hooks win over request-attached hooks", async () => {
  const fromRequest: Partial<Hooks> = { message() {} };
  const fromResponse: Partial<Hooks> = { message() {} };
  const server = {
    options: {
      fetch: (req: Request) => {
        setWebSocketHooks(req, fromRequest);
        return Object.assign(new Response("ok"), { crossws: fromResponse });
      },
    },
  } as unknown as Server;
  const resolve = defaultResolve(server, {});
  await expect(resolve!(new Request("http://localhost/") as never)).resolves.toBe(fromResponse);
});

test("response hooks win over request hooks in the `{ crossws, headers }` shortcut", async () => {
  const fromRequest: Partial<Hooks> = { message() {} };
  const fromResponse: Partial<Hooks> = { open() {} };
  const server = {
    options: {
      fetch: (req: Request) => {
        setWebSocketHooks(req, fromRequest);
        return { crossws: fromResponse, headers: { "x-hello": "world" } };
      },
    },
  } as unknown as Server;
  const resolve = defaultResolve(server, {});
  const hooks = await resolve!(new Request("http://localhost/") as never);
  // The shortcut composes its own `upgrade`, so compare the carried hook.
  expect(hooks.open).toBe(fromResponse.open);
  expect(hooks.message).toBeUndefined();
  const result = await (hooks as Required<Hooks>).upgrade(
    new Request("http://localhost/") as never,
  );
  expect(new Headers((result as { headers: HeadersInit }).headers).get("x-hello")).toBe("world");
});

test("request hooks still apply the `{ headers }` handshake shortcut", async () => {
  // The request channel must not bypass the plain-object result shape, or a
  // framework using both would silently lose its handshake headers.
  const port = await getRandomPort("localhost");
  const server = serve({
    port,
    hostname: "127.0.0.1",
    fetch: (req) => {
      setWebSocketHooks(req, {
        message(peer, message) {
          peer.send(message.text());
        },
      });
      return { headers: { "x-hello": "world" } };
    },
    websocket: {},
  });
  currentServer = server;
  await server.ready();

  const client = new WebSocket(`ws://127.0.0.1:${port}/`);
  const [res] = (await once(client, "upgrade")) as [{ headers: Record<string, string> }];
  expect(res.headers["x-hello"]).toBe("world");
  client.send("hi");
  const [reply] = await once(client, "message");
  expect(reply.toString()).toBe("hi");
  client.close();
  await once(client, "close");
});

test("request hooks do not override an error/redirect response (auth parity)", async () => {
  // Middleware that rejects *after* the WebSocket handler ran (an error mapped
  // to 500, a post-`next()` redirect) must still abort the handshake — the
  // request channel only recovers lost hooks, it never reinterprets a response.
  for (const status of [401, 302, 500]) {
    const server = {
      options: {
        fetch: (req: Request) => {
          setWebSocketHooks(req, { message() {} });
          return new Response("nope", { status });
        },
      },
    } as unknown as Server;
    const resolve = defaultResolve(server, {});
    const hooks = await resolve!(new Request("http://localhost/") as never);
    const res = await (hooks as Required<Hooks>).upgrade(new Request("http://localhost/") as never);
    expect((res as Response).status).toBe(status);
  }
});

test("a 426 with no hooks on either channel still aborts, warning only once", async () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    const server = {
      options: { fetch: () => new Response("WebSocket upgrade is required.", { status: 426 }) },
    } as unknown as Server;
    const resolve = defaultResolve(server, {});
    // Twice: the warning sits on a per-connection path a client can hit at
    // will, so it must not flood the log.
    for (const _ of [1, 2]) {
      const hooks = await resolve!(new Request("http://localhost/") as never);
      const res = await (hooks as Required<Hooks>).upgrade(
        new Request("http://localhost/") as never,
      );
      expect((res as Response).status).toBe(426);
    }
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("426"));
  } finally {
    warn.mockRestore();
  }
});

test("request hooks resolve for a restored peer request (no upgrade seed)", async () => {
  // Hibernation-style restore (Cloudflare Durable Objects) re-enters `resolve`
  // with a synthesized `StubRequest` rather than the original upgrade request.
  // The default resolver passes that same object to `fetch`, so the request
  // channel still round-trips.
  const hooks: Partial<Hooks> = { message() {} };
  const server = {
    options: {
      fetch: (req: Request) => {
        setWebSocketHooks(req, hooks);
        return new Response(null, { status: 200 });
      },
    },
  } as unknown as Server;
  const resolve = defaultResolve(server, {});
  await expect(resolve!(new StubRequest("http://localhost/ws") as never)).resolves.toBe(hooks);
});

test("defaultResolve throws a clear error when fetch is missing", () => {
  const server = { options: {} } as unknown as Server;
  expect(() => defaultResolve(server, {})).toThrow(
    "[crossws] server has no fetch handler to resolve WebSocket hooks from",
  );
});
