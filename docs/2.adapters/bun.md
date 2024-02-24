---
icon: simple-icons:bun
---

# Bun

> Integrate CrossWS with Bun.

To integrate CrossWS with your Bun server, you need to handle upgrade with `handleUpgrade` util and also pass the `websocket` object returned from the adapter to server options. CrossWS leverages native Bun WebSocket API.

```ts
import wsAdapter from "./dist/adapters/bun";

const { websocket, handleUpgrade } = wsAdapter({ message: console.log });

Bun.serve({
  port: 3000,
  websocket,
  fetch(req, server) {
    if (handleUpgrade(req, server)) {
      return;
    }
    return new Response(
      `<script>new WebSocket("ws://localhost:3000").addEventListener('open', (e) => e.target.send("Hello from client!"));</script>`,
      { headers: { "content-type": "text/html" } },
    );
  },
});
```

## Adapter Hooks

- `bun:message (peer, ws, message)`
- `bun:open (peer, ws)`
- `bun:close (peer, ws)`
- `bun:drain (peer)`
- `bun:error (peer, ws, error)`
- `bun:ping (peer, ws, data)`
- `bun:pong (peer, ws, data)`

::read-more
See [`playground/bun.ts`](https://github.com/unjs/crossws/tree/main/playground/bun.ts) for demo and [`src/adapters/bun.ts`](https://github.com/unjs/crossws/tree/main/src/adapters/bun.ts) for implementation.
::
