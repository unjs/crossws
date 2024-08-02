// You can run this demo using `npm run play:cf` in repo
import type { Request, ExecutionContext } from "@cloudflare/workers-types";
import cloudflareAdapter from "../src/adapters/cloudflare";
import { createDemo, getIndexHTML } from "./_shared.ts";

const ws = createDemo(cloudflareAdapter);

export default {
  async fetch(
    request: Request,
    env: Record<string, any>,
    context: ExecutionContext,
  ) {
    if (request.headers.get("upgrade") === "websocket") {
      return ws.handleUpgrade(request, env, context);
    }

    return new Response(await getIndexHTML(), {
      headers: { "content-type": "text/html" },
    });
  },
};
