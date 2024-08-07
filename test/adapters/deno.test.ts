import { describe } from "vitest";
import { wsTestsExec } from "../_utils";

describe("deno", () => {
  wsTestsExec("deno run --unstable-byonm -A ./deno.ts", {
    resHeaders: false,
    adapter: "deno",
  });
});
