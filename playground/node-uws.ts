// You can run this demo using `npm run play:node-uws` in repo

import { App } from "uWebSockets.js";
import nodeAdapter from "../src/adapters/node-uws.ts";
import { createDemo, getIndexHTML } from "./_common";

const adapter = createDemo(nodeAdapter);

const app = App().ws("/*", adapter.websocket);

app.get("/*", async (res, req) => {
  res.writeStatus("200 OK");
  res.writeHeader("Content-Type", "text/html");
  res.end(await getIndexHTML({ name: "node-uws" }));
});

app.listen(3001, () => {
  console.log("Listening to port 3001");
});
