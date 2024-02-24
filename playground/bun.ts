// You can run this demo using `bun --bun ./bun.ts` or `npm run play:bun` in repo

import bunAdapter from "../src/adapters/bun";
import { createDemo, getIndexHTML } from "./_common";

const adapter = createDemo(bunAdapter);

Bun.serve({
  port: 3001,
  websocket: adapter.websocket,
  async fetch(req, server) {
    if (server.upgrade(req, { data: { req, server } })) {
      return;
    }
    return new Response(await getIndexHTML({ name: "bun" }), {
      headers: { "Content-Type": "text/html" },
    });
  },
});
