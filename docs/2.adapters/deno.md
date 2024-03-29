---
icon: teenyicons:deno-solid
---

# Deno

> Integrate CrossWS with Deno.

To integrate CrossWS with your Deno server, you need to check for the `upgrade` header and then call `handleUpgrade` method from the adapter passing the incoming request object. The returned value is the server upgrade response.

```ts
import wsAdapter from "crossws/adapters/deno";

const { handleUpgrade } = wsAdapter({
  hooks: {
    message: console.log,
  },
});

Deno.serve({ port: 3000 }, (request, info) => {
  if (request.headers.get("upgrade") === "websocket") {
    return handleUpgrade(request, info);
  }
  return new Response(
    `<script>new WebSocket("ws://localhost:3000").addEventListener("open", (e) => e.target.send("Hello from client!"));</script>`,
    { headers: { "content-type": "text/html" } },
  );
});
```

## Adapter Hooks

- `deno:open (peer)`
- `deno:message (peer, event)`
- `deno:close (peer)`
- `deno:error (peer, error)`

::read-more
See [`playground/deno.ts`](./playground/deno.ts) for demo and [`src/adapters/deno.ts`](./src/adapters/deno.ts) for implementation.
::
