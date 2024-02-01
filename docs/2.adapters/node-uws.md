# Node.js (uWebSockets)

Integrate CrossWS with Node.js using uWebSockets.js.

Instead of [using `ws`](/adapters/node-ws) you can use [uWebSockets.js](https://github.com/uNetworking/uWebSockets.js) for Node.js servers.

```ts
import { App } from "uWebSockets.js";
import wsAdapter from "crossws/adapters/node-uws";

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

## Learn More

See [`playground/node-uws.ts`](https://github.com/unjs/crossws/tree/main/playground/node-uws.ts) for demo and [`src/adapters/node-uws.ts`](https://github.com/unjs/crossws/tree/main/src/adapters/node-uws.ts) for implementation.
