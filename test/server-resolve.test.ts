import { once } from "node:events";
import { getRandomPort } from "get-port-please";
import { afterEach, beforeEach, expect, test } from "vitest";
import WebSocket from "ws";
import { serve } from "../src/server/node.ts";
import { defaultResolve } from "../src/server/_resolve.ts";
import type { Server } from "srvx";
import type { Hooks } from "../src/hooks.ts";
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

test("defaultResolve throws a clear error when fetch is missing", () => {
  const server = { options: {} } as unknown as Server;
  expect(() => defaultResolve(server, {})).toThrow(
    "[crossws] server has no fetch handler to resolve WebSocket hooks from",
  );
});
