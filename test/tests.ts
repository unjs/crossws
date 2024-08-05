import { expect, test } from "vitest";
import { wsConnect } from "./_utils";

export function wsTests(
  getURL: () => string,
  opts: { pubsub?: boolean; resHeaders?: boolean } = {},
) {
  test("http works", async () => {
    const response = await fetch(getURL().replace("ws", "http"));
    expect(response.status).toBe(200);
  });

  test("connect to websocket", async () => {
    const ws = await wsConnect(getURL());
    expect(await ws.next()).toBe("Welcome to the server #1!");
  });

  test("send ping", async () => {
    const ws = await wsConnect(getURL(), { skip: 1 });
    await ws.send("ping");
    expect(await ws.next()).toBe("pong");
  });

  test("send message", async () => {
    const ws1 = await wsConnect(getURL(), { skip: 1 });
    const ws2 = await wsConnect(getURL(), { skip: 1 });
    if (opts.pubsub !== false) {
      expect(await ws1.next()).toBe("#4 joined!");
    }
    await ws1.send("hello from 1");
    expect(await ws1.next()).toBe("hello from 1");
    if (opts.pubsub !== false) {
      expect(await ws2.next()).toBe("hello from 1");
    }
    await ws2.send("hello from 2");
    if (opts.pubsub !== false) {
      expect(await ws1.next()).toBe("hello from 2");
    }
    expect(await ws2.next()).toBe("hello from 2");
  });

  test("binary message", async () => {
    const ws = await wsConnect(getURL(), { skip: 1 });
    await ws.send(new TextEncoder().encode("binary"));
    expect((await ws.next()).buffer).toMatchObject(
      new TextEncoder().encode("binary message works!").buffer,
    );
  });

  test.skipIf(opts.resHeaders === false)(
    "upgrade response headers",
    async () => {
      const ws = await wsConnect(getURL());
      expect(ws.upgradeHeaders["x-powered-by"]).toBe("cross-ws");
      expect(ws.upgradeHeaders["set-cookie"]).toMatchObject([
        "cross-ws=1; SameSite=None; Secure",
      ]);
    },
  );

  test("upgrade request headers", async () => {
    const ws = await wsConnect(getURL(), {
      skip: 1,
      headers: { "x-test": "1" },
    });
    await ws.send("debug");
    const { headers } = await ws.next();
    expect(headers["connection"]).toBe("Upgrade");
    expect(headers["x-test"]).toBe("1");
  });
}
