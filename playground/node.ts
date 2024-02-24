// You can run this demo using `npm run play:node` in repo

import { createServer } from "node:http";
import nodeAdapter from "../src/adapters/node";
import { createDemo, getIndexHTML } from "./_shared";

const adapter = createDemo(nodeAdapter);

const server = createServer(async (req, res) => {
  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(await getIndexHTML());
});

server.on("upgrade", adapter.handleUpgrade);

const port = process.env.PORT || 3001;
server.listen(3001, () => {
  console.log(`Server running at http://localhost:${port}/`);
});
