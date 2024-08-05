import { describe } from "vitest";
import { wsTestsExec } from "../_utils";

describe("deno", () => {
  wsTestsExec("deno run -A ./deno.ts", { pubsub: false, resHeaders: false });
});
