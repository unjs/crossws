# Cloudflare

Integrate CrossWS with Cloudflare Workers.

To integrate CrossWS with your Cloudflare Workers, you need to check for the `upgrade` header.

```ts
import wsAdapter from "crossws/adapters/cloudflare";

const { handleUpgrade } = wsAdapter({ message: console.log });

export default {
  async fetch(request, env, context) {
    if (request.headers.get("upgrade") === "websocket") {
      return handleUpgrade(request, env, context);
    }
    return new Response(
      `<script>new WebSocket("ws://localhost:3000").addEventListener("open", (e) => e.target.send("Hello from client!"));</script>`,
      { headers: { "content-type": "text/html" } },
    );
  },
};
```

## Adapter Hooks

- `cloudflare:accept (peer)`
- `cloudflare:message (peer, event)`
- `cloudflare:error (peer, event)`
- `cloudflare:close (peer, event)`

## Learn More

See [`playground/cloudflare.ts`](https://github.com/unjs/crossws/tree/main/playground/cloudflare.ts) for demo and [`src/adapters/cloudflare.ts`](https://github.com/unjs/crossws/tree/main/src/adapters/cloudflare.ts) for implementation.
