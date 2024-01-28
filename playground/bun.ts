// You can run this demo using `bun --bun ./bun.ts` or `npm run play:bun` in repo

/// <reference types="bun-types" />

import bunAdapter from "../src/adapters/bun";
import { createDemo, getIndexHTMLURL } from "./_common";

const adapter = createDemo(bunAdapter);

Bun.serve({
  port: 3001,
  websocket: adapter.websocket,
  fetch(req, server) {
    if (server.upgrade(req)) {
      return;
    }
    return new Response(Bun.file(getIndexHTMLURL()), {
      headers: { "Content-Type": "text/html" },
    });
  },
});
