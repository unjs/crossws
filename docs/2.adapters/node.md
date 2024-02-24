---
icon: akar-icons:node-fill
---

# Node.js

> Integrate CrossWS with Node.js using ws or uWebSockets.js

To integrate CrossWS with your Node.js HTTP server, you need to connect the `upgrade` event to the `handleUpgrade` method returned from the adapter. CrossWS uses a prebundled version of [ws](https://github.com/websockets/ws).

```ts
import { createServer } from "node:http";
import wsAdapter from "crossws/adapters/node";

const server = createServer((req, res) => {
  res.end(
    `<script>new WebSocket("ws://localhost:3000").addEventListener('open', (e) => e.target.send("Hello from client!"));</script>`,
  );
}).listen(3000);

const { handleUpgrade } = wsAdapter({ message: console.log });
server.on("upgrade", handleUpgrade);
```

## Adapter Hooks

- `node:open (peer)`
- `node:message (peer, data, isBinary)`
- `node:close (peer, code, reason)`
- `node:error (peer, error)`
- `node:ping (peer)`
- `node:pong (peer)`
- `node:unexpected-response (peer, req, res)`
- `node:upgrade (peer, req)`

::read-more
See [`playground/node.ts`](https://github.com/unjs/crossws/tree/main/playground/node.ts) for demo and [`src/adapters/node.ts`](https://github.com/unjs/crossws/tree/main/src/adapters/node.ts) for implementation.
::

## uWebSockets

Integrate CrossWS with Node.js using uWebSockets.js.

Instead of [using `ws`](/adapters/node-ws) you can use [uWebSockets.js](https://github.com/uNetworking/uWebSockets.js) for Node.js servers.

```ts
import { App } from "uWebSockets.js";
import wsAdapter from "crossws/adapters/uws";

const { websocket } = wsAdapter({ message: console.log });

const server = App().ws("/*", websocket);

server.get("/*", (res, req) => {
  res.writeStatus("200 OK").writeHeader("Content-Type", "text/html");
  res.end(
    `<script>new WebSocket("ws://localhost:3000").addEventListener('open', (e) => e.target.send("Hello from client!"));</script>`,
  );
});

server.listen(3001, () => {
  console.log("Listening to port 3001");
});
```

## Adapter Hooks

- `uws:open (ws)`
- `uws:message (ws, message, isBinary)`
- `uws:close (ws, code, message)`
- `uws:ping (ws, message)`
- `uws:pong (ws, message)`
- `uws:drain (ws)`
- `uws:upgrade (res, req, context)`
- `uws:subscription (ws, topic, newCount, oldCount)`

::read-more
See [`playground/node-uws.ts`](https://github.com/unjs/crossws/tree/main/playground/node-uws.ts) for demo and [`src/adapters/node-uws.ts`](https://github.com/unjs/crossws/tree/main/src/adapters/node-uws.ts) for implementation.
::
