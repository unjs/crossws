---
icon: clarity:two-way-arrows-line
---

# SSE

> Integrate crossws with server-sent events and fetch-api.

If your deployment target does not supports handling WebSocket upgrades, crossws SSE adapter allows to add integration based on web platform standards ([`fetch`](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) and [`EventSource`](https://developer.mozilla.org/en-US/docs/Web/API/EventSource))

> [!IMPORTANT]
> This is an experimental adapter and requires a custom [`WebsocketSSE`](#client-side) client to connect.

## Usage

### Server side

> [!NOTE]
> HTTP/2 + TLS is recommended in order to increase browser limitations about number of SSE connections (from 6 to 100) and also to allow bidirectional messaging with streaming.

Define adapter:

```ts
import sseAdapter from "crossws/adapters/sse";

const ws = sseAdapter({
  bidir: true, // Enable bidirectional messaging support
  hooks: {
    upgrade(request) {
      // In case of bidirectional mode, extra auth is recommended based on request
      // You can return a new Response() instead to abort
      return {
        headers: {},
      };
    },
    open(peer) {
      // Use this hook to send messages to peer
      peer.send(`Welcome ${peer}`);
    },
    message(peer, message) {
      // Accepting messages from peer (bidirectional mode)
      console.log(`Message from ${peer}: ${message}`); // Message from <id>: ping
    },
  },
});
```

Inside your web server handler:

```js
async fetch(request) {
  // Handle crossws upgrade
  if (
    request.headers.get("accept") === "text/event-stream" ||
    request.headers.has("x-crossws-id")
  ) {
    return ws.fetch(request);
  }

  // Your normal application logic
  return new Response("default page")
}
```

### Using with Express or other Node.js frameworks

The SSE adapter's `ws.fetch` is a Web-standard fetch handler: it takes a [`Request`](https://developer.mozilla.org/en-US/docs/Web/API/Request) and returns a [`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response). Node.js frameworks like [Express](https://expressjs.com/) instead work with the raw Node.js `(req, res)` style, so you need a small bridge to convert between the two.

Rather than manually converting streams with `Readable.toWeb`/`Readable.fromWeb` and copying over status/headers by hand, use the [`toNodeHandler`](https://srvx.h3.dev/guide/node) helper from [srvx](https://srvx.h3.dev/), which turns any Web-standard fetch handler into a plain `(req, res)` Node.js handler:

```js
import express from "express";
import { toNodeHandler } from "srvx/node";
import sseAdapter from "crossws/adapters/sse";

const ws = sseAdapter({
  hooks: {
    /* ... */
  },
});

const app = express();

app.use((req, res, next) => {
  if (
    req.headers.accept === "text/event-stream" ||
    req.headers["x-crossws-id"]
  ) {
    return toNodeHandler((request) => ws.fetch(request))(req, res);
  }
  next();
});
```

> [!NOTE]
> This is not specific to Express: `toNodeHandler` only needs the raw Node.js `req`/`res` objects, so the same pattern works for any framework whose handler ultimately exposes them — Fastify's `request.raw`/`reply.raw`, NestJS running on top of its Express or Fastify adapter, or a plain `node:http` server.

### Client side

In order to make communication with server, we need a special `WebsocketSSE` client.

```js
import { WebsocketSSE } from "crossws/websocket/sse";

const ws = new WebsocketSSE("https://<server_address>", { bdir: true });

ws.addEventListener("open", () => {
  ws.send("ping");
});

ws.addEventListener("message", (event) => {
  console.log("Received:", event.data);
});
```

> [!NOTE]
> Behind the scenes, `WebSocketSSE`, uses [`EventSource`](https://developer.mozilla.org/en-US/docs/Web/API/EventSource) to receive messages from server. In order to send messages to the server, it tries to make another connection stream using same peer id and if failed, fallback to [`fetch`](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) for each message.
> In theory, it is possible to have communication on a single HTTP/2 connection, however, due to a [current limitation in fetch standard](https://github.com/whatwg/fetch/issues/1254) we need 2 connections, one for receiving messages and one for sending.

::read-more
See [`test/fixture/sse.ts`](https://github.com/h3js/crossws/blob/main/test/fixture/sse.ts) for demo and [`src/adapters/sse.ts`](https://github.com/h3js/crossws/blob/main/src/adapters/sse.ts) for implementation.
::
