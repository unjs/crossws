import { describe, beforeAll, vi, afterAll } from "vitest";
import { wsTestsExec } from "../_utils";
import { WebSocketSSE } from "../../src/websocket/sse";
import * as undici from "undici";

globalThis.EventSource = globalThis.EventSource || (undici.EventSource as any);

describe("sse", () => {
  beforeAll(() => {
    vi.stubGlobal("WebSocket", WebSocketSSE);
  });
  afterAll(() => {
    vi.unstubAllGlobals();
  });
  wsTestsExec("deno run --unstable-byonm -A ./sse.ts", {
    adapter: "sse",
    resHeaders: false, // works but not testable
  });
});
