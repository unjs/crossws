// You can run this demo using `npm run play:node-uws` in repo

import { readFileSync } from "node:fs";

import { App } from "uWebSockets.js";

import nodeAdapter from "../src/adapters/node-uws.ts";
import { createDemo, getIndexHTMLURL } from "./_common";

const adapter = createDemo(nodeAdapter);

const app = App().ws("/*", adapter.websocket);

app.get("/*", (res, req) => {
  res.writeStatus("200 OK");
  res.writeHeader("Content-Type", "text/html");
  const indexHTML = readFileSync(getIndexHTMLURL(), "utf8");
  res.end(indexHTML);
});

app.listen(3001, () => {
  console.log("Listening to port 3001");
});
