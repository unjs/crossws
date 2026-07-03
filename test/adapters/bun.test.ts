import { describe } from "vitest";
import { wsTestsExec } from "../_utils";
import { wsTests, pingPongTests } from "../tests";

describe("bun", () => {
  wsTestsExec("bun run ./bun.ts", { adapter: "bun" }, (getURL, opts) => {
    wsTests(getURL, opts);
    pingPongTests(getURL);
  });
});
