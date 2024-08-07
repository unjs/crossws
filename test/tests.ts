import { expect, test } from "vitest";
import { wsConnect } from "./_utils";

export function wsTests(
  getURL: () => string,
  opts: { adapter: string; pubsub?: boolean; resHeaders?: boolean },
) {
  test("http works", async () => {
    const response = await fetch(getURL().replace("ws", "http"));
    expect(response.status).toBe(200);
  });

  test("connect to websocket", async () => {
    const ws = await wsConnect(getURL());
    expect(await ws.next()).toMatch(/Welcome to the server \w+/);
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
      expect(await ws1.next()).toMatch(/\w+ joined!/);
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

  test("upgrade request url", async () => {
    const ws = await wsConnect(getURL() + "?foo=bar", { skip: 1 });
    await ws.send("debug");
    const info = await ws.next();
    expect(info.url).toMatch(/^http:\/\/localhost:\d+\/\?foo=bar$/);
    const url = new URL(info.url);
    expect(url.search).toBe("?foo=bar");
  });

  test("upgrade fail response", async () => {
    await expect(wsConnect(getURL() + "?unauthorized")).rejects.toMatchObject({
      cause: {
        status: 401,
        statusText: "Unauthorized",
        body: "unauthorized",
        headers: { "x-error": "unauthorized" },
      },
    });
  });

  test("get peers from adapter", async () => {
    await wsConnect(getURL());
    await wsConnect(getURL());
    const response = await fetch(getURL().replace("ws", "http") + "peers");
    const { peers } = (await response.json()) as any;
    expect(peers.length).toBe(2);
  });

  test("get peers from peer", async () => {
    const ws1 = await wsConnect(getURL(), { skip: 1 });
    const ws2 = await wsConnect(getURL(), { skip: 1 });
    if (opts.pubsub !== false) {
      ws1.skip(); // join message for ws2
    }
    await ws1.send("peers");
    await ws2.send("peers");
    const { peers: peers1 } = await ws1.next();
    const { peers: peers2 } = await ws2.next();
    expect(peers1.length).toBe(2);
    expect(peers1).toMatchObject(peers2);
  });

  test.skipIf(opts.adapter.startsWith("cloudflare"))(
    "publish to all peers from adapter",
    async () => {
      const ws1 = await wsConnect(getURL(), { skip: 1 });
      const ws2 = await wsConnect(getURL(), { skip: 1 });
      ws1.skip(); // join message for ws2
      await fetch(
        getURL().replace("ws", "http") + `publish?topic=chat&message=ping`,
      );
      expect(await ws1.next()).toBe("ping");
      expect(await ws2.next()).toBe("ping");
    },
  );
}
