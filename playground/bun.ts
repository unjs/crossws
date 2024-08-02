// You can run this demo using `bun --bun ./bun.ts` or `npm run play:bun` in repo

import bunAdapter from "../src/adapters/bun";
import { createDemo, getIndexHTML } from "./_shared";

const ws = createDemo(bunAdapter);

Bun.serve({
  port: 3001,
  websocket: ws.websocket,
  async fetch(request, server) {
    if (request.headers.get("upgrade") === "websocket") {
      return ws.handleUpgrade(request, server);
    }
    return new Response(await getIndexHTML(), {
      headers: { "Content-Type": "text/html" },
    });
  },
});
