import { describe, test, expect } from "vitest";
import { wsTestsExec } from "../_utils";
import { EventSource } from "undici";

describe("sse", () => {
  wsTestsExec(
    "deno run --unstable-byonm -A ./sse.ts",
    { adapter: "sse" },
    (getURL) => {
      test("connects to the server", async () => {
        const url = getURL().replace("ws", "http") + "_sse";
        const ev = new EventSource(url);
        const messages: string[] = [];
        ev.addEventListener("message", (event) => {
          messages.push(event.data);
        });
        await new Promise((resolve) => ev.addEventListener("open", resolve));
        await new Promise((resolve) => ev.addEventListener("message", resolve));
        ev.close();
        expect(messages[0]).toMatch(/Welcome to the server \w+/);
        expect(messages.length).toBe(1);
      });
    },
  );
});
