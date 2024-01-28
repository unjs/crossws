// You can run this demo using `npm run play:cf` in repo

/// <reference types="@cloudflare/workers-types" />

import cloudflareAdapter from "../src/adapters/cloudflare";

import { createDemo, importIndexHTML } from "./_common.ts";

const { handleUpgrade } = createDemo(cloudflareAdapter);

export default {
  async fetch(
    request: Request,
    env: Record<string, any>,
    context: ExecutionContext,
  ) {
    if (request.headers.get("upgrade") === "websocket") {
      return handleUpgrade(request, env, context);
    }

    return new Response(await importIndexHTML(), {
      headers: { "content-type": "text/html" },
    });
  },
};
