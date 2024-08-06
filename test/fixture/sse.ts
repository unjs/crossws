// You can run this demo using `npm run play:sse` in repo

import sseAdapter from "../../src/adapters/sse";
import { createDemo, getIndexHTML, handleDemoRoutes } from "./_shared";

const ws = createDemo(sseAdapter);

Bun.serve({
  port: process.env.PORT || 3001,
  hostname: "localhost",
  async fetch(request) {
    const response = handleDemoRoutes(ws, request);
    if (response) {
      return response;
    }

    // Handle SSE
    if (request.headers.get("accept") === "text/event-stream") {
      return ws.fetch(request);
    }

    return new Response(await getIndexHTML({ sse: true }), {
      headers: { "Content-Type": "text/html" },
    });
  },
});
