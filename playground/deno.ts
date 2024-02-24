// You can run this demo using `deno run -A ./deno.ts` or  `npm run play:deno` in repo

import denoAdapter from "../src/adapters/deno.ts";

// @ts-ignore
import type * as _Deno from "../types/lib.deno.d.ts";

import { createDemo, getIndexHTML } from "./_shared.ts";

declare global {
  const Deno: typeof import("@deno/types").Deno;
}

const adapter = createDemo(denoAdapter);

Deno.serve({ port: 3001 }, async (req) => {
  if (req.headers.get("upgrade") === "websocket") {
    return adapter.handleUpgrade(req);
  }

  return new Response(await getIndexHTML({ name: "deno" }), {
    headers: { "Content-Type": "text/html" },
  });
});
