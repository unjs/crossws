import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createServer, Server } from "node:http";
import { WebSocket } from "ws";
import { getRandomPort, waitForPort } from "get-port-please";
import nodeAdapter from "../../src/adapters/node";
import { defineHooks } from "../../src/index";
import { createDemo } from "../fixture/_shared";
import { wsTests } from "../tests";
import { wsConnect } from "../_utils";

describe("node", () => {
  let server: Server;
  let url: string;
  let ws: ReturnType<typeof createDemo<typeof nodeAdapter>>;

  beforeAll(async () => {
    ws = createDemo(nodeAdapter);
    server = createServer((req, res) => {
      if (req.url === "/peers") {
        return res.end(
          JSON.stringify({
            peers: [...ws.peers].flatMap(([namespace, peers]) =>
              [...peers].map((p) => `${namespace}:${p.id}`),
            ),
          }),
        );
      } else if (req.url!.startsWith("/publish")) {
        const q = new URLSearchParams(req.url!.split("?")[1]);
        const topic = q.get("topic") || "";
        const message = q.get("message") || "";
        if (topic && message) {
          ws.publish(topic, message);
          return res.end("published");
        }
      }
      res.end("ok");
    });
    server.on("upgrade", ws.handleUpgrade);
    const port = await getRandomPort("localhost");
    url = `ws://localhost:${port}/`;
    await new Promise<void>((resolve) => server.listen(port, resolve));
    await waitForPort(port);
  });

  afterAll(() => {
    ws.closeAll();
    server.close();
  });

  wsTests(() => url, {
    adapter: "node",
  });

  test("forcefully terminates when force=true", async () => {
    ws.closeAll(undefined, undefined, true);
    for (const [_ns, peers] of ws.peers) {
      for (const peer of peers) {
        expect(peer.websocket.readyState).toBe(2 /* CLOSING */);
      }
    }
  });
});

// Half-open connections (laptop sleep, NAT/mobile idle timeout, power loss)
// vanish without ever delivering a TCP FIN/RST, so `ws` never emits `'close'`
// and the peer leaks forever. The `idleTimeout` option pings peers and
// terminates any that miss the pong. Simulated here with an `autoPong: false`
// client that receives pings but never answers them.
describe("node (idleTimeout terminates unresponsive peers)", () => {
  let server: Server;
  let url: string;
  let ws: ReturnType<typeof nodeAdapter>;
  const closes: Array<{ code: number | undefined }> = [];

  beforeAll(async () => {
    ws = nodeAdapter({
      idleTimeout: 0.04, // seconds (40ms) — fast sweep for the test
      hooks: defineHooks({
        close(_peer, details) {
          closes.push({ code: details.code });
        },
      }),
    });
    server = createServer((_req, res) => res.end("ok"));
    server.on("upgrade", ws.handleUpgrade);
    const port = await getRandomPort("localhost");
    url = `ws://localhost:${port}/`;
    await new Promise<void>((resolve) => server.listen(port, resolve));
    await waitForPort(port);
  });

  afterAll(async () => {
    await ws.close();
    server.close();
  });

  test("terminates a peer that never answers pings", async () => {
    // A well-behaved client auto-pongs and must survive the heartbeat.
    const alive = new WebSocket(url);
    await new Promise((resolve) => alive.on("open", resolve));

    // A silent client never pongs -> the sweep must terminate it.
    const dead = new WebSocket(url, { autoPong: false });
    const deadClosed = new Promise<number>((resolve) => dead.on("close", (code) => resolve(code)));
    await new Promise((resolve) => dead.on("open", resolve));

    // First sweep marks not-alive + pings; second sweep (no pong seen)
    // terminates. Allow a few intervals of slack.
    const closeCode = await Promise.race([
      deadClosed,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("dead peer was not terminated")), 1000),
      ),
    ]);
    expect(closeCode).toBe(1006);
    expect(alive.readyState).toBe(WebSocket.OPEN);
    // The server-side `close` hook fires a tick after `terminate()` destroys the
    // socket — wait for it so downstream teardown (proxy upstream close) is
    // exercised through the normal path.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(closes.some((c) => c.code === 1006)).toBe(true);

    alive.close();
  });
});

// Regression: with `clientTracking: false` (or a user-supplied `wss` created
// that way), `ws` leaves `wss.clients` `undefined`. The idle sweep — default-on
// since `idleTimeout` defaults to 30 — used to iterate `wss.clients` and threw
// `TypeError: undefined is not iterable` every tick. crossws now tracks its own
// sockets, so the sweep still detects and terminates dead peers without crashing.
describe("node (idleTimeout with clientTracking disabled)", () => {
  let server: Server;
  let url: string;
  let ws: ReturnType<typeof nodeAdapter>;

  beforeAll(async () => {
    ws = nodeAdapter({
      idleTimeout: 0.04, // seconds (40ms) — fast sweep for the test
      serverOptions: { clientTracking: false },
    });
    server = createServer((_req, res) => res.end("ok"));
    server.on("upgrade", ws.handleUpgrade);
    const port = await getRandomPort("localhost");
    url = `ws://localhost:${port}/`;
    await new Promise<void>((resolve) => server.listen(port, resolve));
    await waitForPort(port);
  });

  afterAll(async () => {
    await ws.close();
    server.close();
  });

  test("sweep terminates a silent peer without touching wss.clients", async () => {
    const dead = new WebSocket(url, { autoPong: false });
    const deadClosed = new Promise<number>((resolve) => dead.on("close", (code) => resolve(code)));
    await new Promise((resolve) => dead.on("open", resolve));

    const closeCode = await Promise.race([
      deadClosed,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("dead peer was not terminated")), 1000),
      ),
    ]);
    expect(closeCode).toBe(1006);
  });
});

// Regression: `NodePeer._publish` derived `isBinary` from the raw payload, so a
// non-string value (a plain object, which `toBufferLike` serializes to a JSON
// string) was broadcast as a *binary* frame. The `_publish` fan-out path is only
// hit by subscribers other than the first (the first receives via `peer.send`,
// which was already correct), so the test needs two subscribers and asserts the
// second one receives a text frame.
describe("node (publish object frame type)", () => {
  let server: Server;
  let url: string;
  let ws: ReturnType<typeof nodeAdapter>;

  beforeAll(async () => {
    ws = nodeAdapter({
      hooks: defineHooks({
        open(peer) {
          peer.subscribe("room");
        },
      }),
    });
    server = createServer((_req, res) => res.end("ok"));
    server.on("upgrade", ws.handleUpgrade);
    const port = await getRandomPort("localhost");
    url = `ws://localhost:${port}/`;
    await new Promise<void>((resolve) => server.listen(port, resolve));
    await waitForPort(port);
  });

  afterAll(() => {
    ws.closeAll();
    server.close();
  });

  test("publishing a plain object delivers a text frame, not binary", async () => {
    const clientA = await wsConnect(url); // first subscriber -> receives via send()
    const clientB = await wsConnect(url); // later subscriber -> receives via _publish()
    // Let both open hooks subscribe to "room" before publishing.
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Inspect the raw frame on B: a text frame arrives as a string, a binary
    // frame as an ArrayBuffer (wsConnect sets binaryType = "arraybuffer").
    const frame = new Promise<{ isString: boolean; data: unknown }>((resolve) => {
      clientB.ws.addEventListener("message", (event) => {
        resolve({ isString: typeof event.data === "string", data: event.data });
      });
    });
    void clientA;

    ws.publish("room", { hello: "world" });

    const received = await frame;
    expect(received.isString).toBe(true);
    expect(JSON.parse(received.data as string)).toEqual({ hello: "world" });
  });
});
