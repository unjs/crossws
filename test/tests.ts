import { expect, test } from "vitest";
import { wsConnect } from "./_utils";

export function wsTests(getURL: () => string, pubsub = true) {
  test("http works", async () => {
    const response = await fetch(getURL().replace("ws", "http"));
    expect(response.status).toBe(200);
  });

  test("connect to websocket", async () => {
    const ws = await wsConnect(getURL());
    expect(await ws.next()).toBe("Welcome to the server #1!");
    expect(await ws.next()).toBe("(binary message works!)");
  });

  test("send ping", async () => {
    const ws = await wsConnect(getURL(), 2);
    await ws.send("ping");
    expect(await ws.next()).toBe("pong");
  });

  test("send message", async () => {
    const ws1 = await wsConnect(getURL(), 2);
    const ws2 = await wsConnect(getURL(), 2);
    if (pubsub) {
      expect(await ws1.next()).toBe("#4 joined!");
    }
    await ws1.send("hello from 1");
    expect(await ws1.next()).toBe("hello from 1");
    if (pubsub) {
      expect(await ws2.next()).toBe("hello from 1");
    }
    await ws2.send("hello from 2");
    if (pubsub) {
      expect(await ws1.next()).toBe("hello from 2");
    }
    expect(await ws2.next()).toBe("hello from 2");
  });
}
