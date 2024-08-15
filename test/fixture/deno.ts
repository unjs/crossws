// You can run this demo using `npm run play:deno` in repo

import denoAdapter from "../../src/adapters/deno.ts";

// @ts-ignore
import type * as _Deno from "../types/lib.deno.d.ts";

import { createDemo, getIndexHTML, handleDemoRoutes } from "./_shared.ts";

const ws = createDemo(denoAdapter);

const port = Number.parseInt(Deno.env.get("PORT") || "") || 3001;

Deno.serve({ hostname: "localhost", port }, async (request, info) => {
  const response = handleDemoRoutes(ws, request);
  if (response) {
    return response;
  }

  if (request.headers.get("upgrade") === "websocket") {
    return ws.handleUpgrade(request, info);
  }
  return new Response(await getIndexHTML(), {
    headers: { "Content-Type": "text/html" },
  });
});
