import { describe, test, expect } from "vitest";
import { wsTestsExec } from "../_utils";
import EventSource from "eventsource";

describe("sse", () => {
  wsTestsExec("bun run ./sse.ts", { adapter: "sse" }, (getURL, opts) => {
    test("connects to the server", async () => {
      const url = getURL().replace("ws", "http");
      const ev = new EventSource(url);
      const messages: string[] = [];
      ev.addEventListener("message", (event) => {
        messages.push(event.data);
      });
      await new Promise((resolve) => ev.addEventListener("open", resolve));
      ev.close();
      expect(messages).toMatchObject(["Welcome to the server #1!"]);
    });
  });
});
