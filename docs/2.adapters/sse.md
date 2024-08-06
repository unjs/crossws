---
icon: oui:token-event
---

# SSE

> Integrate CrossWS with [server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events).

If your deployment server is incapable of of handling WebSocket upgrades but support standard web API ([`Request`](https://developer.mozilla.org/en-US/docs/Web/API/Request) and [`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response)) you can integrate crossws to act as a one way (server to client) handler using [server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events).

> [!IMPORTANT]
> This is an experimental adapter and works only with a limited subset of CrossWS functionalities.

> [!IMPORTANT]
> Instead of [`WebSocket`](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket) client you need to use [`EventSource`](https://developer.mozilla.org/en-US/docs/Web/API/EventSource) as client to connect such server.

```ts
import sseAdapter from "crossws/adapters/sse";

const sse = sseAdapter({
  hooks: {
    upgrade(request) {
      // Handle upgrade logic
      // You can return a custom response to abort
      // You can return { headers } to override default headers
    },
    open(peer) {
      // Use this hook to send messages to peer
      peer.send("hello!");
    },
  },
});
```

Inside your Web compatible server handler:

```js
async fetch(request) {
  const url = new URL(request.url)

  // Handle SSE
  if (url.pathname === "/sse" && request.headers.get("accept") === "text/event-stream") {
    return sse.fetch(request);
  }

  return new Response("server is up!")
}
```

In order to connect to the server, you need to use [`EventSource`](https://developer.mozilla.org/en-US/docs/Web/API/EventSource) as client:

```js
const ev = new EventSource("http://<server>/sse");

ev.addEventListener("message", (event) => {
  console.log(event.data); // hello!
});
```

::read-more
See [`test/fixture/sse.ts`](https://github.com/unjs/crossws/blob/main/test/fixture/sse.ts) for demo and [`src/adapters/sse.ts`](https://github.com/unjs/crossws/blob/main/src/adapters/sse.ts) for implementation.
::
