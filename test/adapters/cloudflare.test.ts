import { describe} from "vitest";
import { wsTestsExec } from "../_utils";

describe("cloudflare", () => {
  wsTestsExec("wrangler dev -c ./wrangler.toml --port $PORT", false);
});

