// You can run this demo using `bun --bun ./bun.ts` or `npm run play:bun` in repo

import bunAdapter from "../../src/adapters/bun";
import { createDemo, getIndexHTML, handleDemoRoutes } from "./_shared";

const ws = createDemo(bunAdapter);

Bun.serve({
  port: process.env.PORT || 3001,
  hostname: "localhost",
  websocket: ws.websocket,
  async fetch(request, server) {
    const response = handleDemoRoutes(ws, request);
    if (response) {
      return response;
    }
    if (request.headers.get("upgrade") === "websocket") {
      return ws.handleUpgrade(request, server);
    }
    return new Response(await getIndexHTML(), {
      headers: { "Content-Type": "text/html" },
    });
  },
});
