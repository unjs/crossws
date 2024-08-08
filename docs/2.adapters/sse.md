---
icon: clarity:two-way-arrows-line
---

# SSE

> Integrate crossws with server-sent events and fetch-api.

If your deployment target does not supports handling WebSocket upgrades, crossws SSE adapter allows to add integration based on web platform standards ([`fetch`](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) and [`EventSource`](https://developer.mozilla.org/en-US/docs/Web/API/EventSource))

> [!IMPORTANT]
> This is an experimental adapter, requires server support and a different way of connection from clients.

> [!NOTE]
> HTTP/2 server support is recommended in order to increase browser limitations about number of SSE connections (from 6 to 100) and also to allow bidirectional messaging with streaming.

## Usage

### Server side

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
  const url = new URL(request.url)

  // Handle SSE
  if (url.pathname === "/sse") {
    return ws.fetch(request);
  }

  return new Response("default page")
}
```

### Client side

In order to receive messages from server, you need to use an [`EventSource`](https://developer.mozilla.org/en-US/docs/Web/API/EventSource) client.

In order to send messages to the server make sure `bdir: true` option is enabled on the server, then you need to first wait for `crosswd-id` to get the peer id associated with connection and then use fetch calls to send messages to the server. You can optionally use a stream to send multiple messages to the server via single connection similar to WebSockets.

> [!NOTE]
> In theory, it is possible to bidirectional communication on a single HTTP/2 connection, however, due to a [current limitation in fetch standard](https://github.com/whatwg/fetch/issues/1254) we need 2 connections, one for receiving messages and one for sending.

```js
const ev = new EventSource("http://<server>/sse");

ev.addEventListener("message", (event) => {
  // Listen for messages from server
  console.log("Message:", event.data); // Welcome <id>!
});

ev.addEventListener("crossws-id", (event) => {
  // Using peer id we can send messages to the server
  const peerId = event.id;

  // Method 1: Send each message with a separated fetch call
  fetch(url, {
    method: "POST",
    headers: { "x-crossws-id": peerId },
    body: "ping", // message
  });

  // Method 2: Using body stream to send multiple messages (requires HTTP/2 + TLS)
  fetch(url, {
    method: "POST",
    duplex: "half",
    headers: {
      "content-type": "application/octet-stream",
      "x-crossws-id": peerId,
    },
    body: new ReadableStream({
      start(controller) {
        // You can send multiple messages to the server with single connection
        controller.enqueue("ping");
      },
    }).pipeThrough(new TextEncoderStream()),
  });
});
```

::read-more
See [`test/fixture/sse.ts`](https://github.com/unjs/crossws/blob/main/test/fixture/sse.ts) for demo and [`src/adapters/sse.ts`](https://github.com/unjs/crossws/blob/main/src/adapters/sse.ts) for implementation.
::
