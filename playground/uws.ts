// You can run this demo using `npm run play:node-uws` in repo

import { App } from "uWebSockets.js";
import uwsAdapter from "../src/adapters/uws";
import { createDemo, getIndexHTML } from "./_shared.ts";

const adapter = createDemo(uwsAdapter);

const app = App().ws("/*", adapter.websocket);

app.get("/*", async (res, req) => {
  res.writeStatus("200 OK");
  res.writeHeader("Content-Type", "text/html");
  res.end(await getIndexHTML({ name: "node-uws" }));
});

app.listen(3001, () => {
  console.log("Listening to port 3001");
});
