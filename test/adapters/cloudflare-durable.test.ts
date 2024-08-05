import { describe } from "vitest";
import { wsTestsExec } from "../_utils";

describe("cloudflare-durable", () => {
  wsTestsExec(
    "wrangler dev -c ./wrangler-durable.toml --inspector-port 0 --port $PORT",
  );
});
