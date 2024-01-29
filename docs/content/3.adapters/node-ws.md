# Node.js (ws)

Integrate CrossWS with Node.js using ws.

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

## Learn More

See [`playground/node.ts`](https://github.com/unjs/crossws/tree/main/playground/node.ts) for demo and [`src/adapters/node.ts`](https://github.com/unjs/crossws/tree/main/src/adapters/node.ts) for implementation.
