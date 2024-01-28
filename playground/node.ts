// You can run this demo using `npm run play:node` in repo

import { createServer } from "node:http";
import { readFileSync } from "node:fs";

import nodeAdapter from "../src/adapters/node";
import { createDemo, getIndexHTMLURL } from "./_common";

const adapter = createDemo(nodeAdapter);

const server = createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/html" });
  const indexHTML = readFileSync(getIndexHTMLURL(), "utf8");
  res.end(indexHTML);
});

server.on("upgrade", adapter.handleUpgrade);

const port = process.env.PORT || 3001;
server.listen(3001, () => {
  console.log(`Server running at http://localhost:${port}/`);
});
