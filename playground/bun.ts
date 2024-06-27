// You can run this demo using `bun --bun ./bun.ts` or `npm run play:bun` in repo

import bunAdapter from "../src/adapters/bun";
import { createDemo, getIndexHTML } from "./_shared";

const { websocket, handleUpgrade, setPublishingServer } = createDemo(bunAdapter);

const server = Bun.serve({
  port: 3001,
  websocket,
  async fetch(req, server) {
    if (await handleUpgrade(req, server)) {
      return;
    }
    return new Response(await getIndexHTML(), {
      headers: { "Content-Type": "text/html" },
    });
  },
});

setPublishingServer(server);
