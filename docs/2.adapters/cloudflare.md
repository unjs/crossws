---
icon: devicon-plain:cloudflareworkers
---

# Cloudflare

> Integrate CrossWS with Cloudflare Workers.

To integrate CrossWS with your Cloudflare Workers, you need to check for the `upgrade` header.

```ts
import wsAdapter from "crossws/adapters/cloudflare";

const ws = wsAdapter({
  hooks: {
    message: console.log,
  },
});

export default {
  async fetch(request, env, context) {
    if (request.headers.get("upgrade") === "websocket") {
      return ws.handleUpgrade(request, env, context);
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

::read-more
See [`playground/cloudflare.ts`](https://github.com/unjs/crossws/tree/main/playground/cloudflare.ts) for demo and [`src/adapters/cloudflare.ts`](https://github.com/unjs/crossws/tree/main/src/adapters/cloudflare.ts) for implementation.
::

## Durable objects support

To integrate CrossWS with Cloudflare [Durable Objects](https://developers.cloudflare.com/durable-objects/api/websockets/) (available on paid plans) with pub/sub and hibernation support, you need to check for the `upgrade` header and additionally export a Durable object with crossws adapter hooks integrated.

```js
import { DurableObject } from "cloudflare:workers";
import wsAdapter from "crossws/adapters/cloudflare-durable";

const ws = wsAdapter({
  // bindingName: "$DurableObject",
  // instanceName: "crossws",
  hooks: {
    message: console.log,
    open(peer) {
      peer.subscribe("chat");
      peer.publish("chat", { user: "server", message: `${peer} joined!` });
    },
  },
});

export default {
  async fetch(request, env, context) {
    if (request.headers.get("upgrade") === "websocket") {
      return ws.handleUpgrade(request, env, context);
    }
    return new Response(
      `<script>new WebSocket("ws://localhost:3000").addEventListener("open", (e) => e.target.send("Hello from client!"));</script>`,
      { headers: { "content-type": "text/html" } },
    );
  },
};

export class $DurableObject extends DurableObject {
  fetch(request) {
    return ws.handleDurableUpgrade(this, request);
  }

  async webSocketMessage(client, message) {
    return ws.handleDurableMessage(this, client, message);
  }

  async webSocketClose(client, code, reason, wasClean) {
    return ws.handleDurableClose(this, client, code, reason, wasClean);
  }
}
```

Update your `wrangler.toml` to specify Durable object:

```ini
[[durable_objects.bindings]]
name = "$DurableObject"
class_name = "$DurableObject"

[[migrations]]
tag = "v1"
new_classes = ["$DurableObject"]
```

::read-more
See [`playground/cloudflare-durable.ts`](https://github.com/unjs/crossws/tree/main/playground/cloudflare-durable.ts) for demo and [`src/adapters/cloudflare-durable.ts`](https://github.com/unjs/crossws/tree/main/src/adapters/cloudflare-durable.ts) for implementation.
::
