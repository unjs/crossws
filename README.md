# ⛨ CrossWS

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]

👉 Elegant, typed, and simple interface to implement platform-agnostic WebSocket servers

🧩 Seamlessly integrates with, [Node.js](https://nodejs.org/en), [Bun](https://bun.sh/), [Deno](https://deno.com/) and [Cloudflare Workers](https://workers.cloudflare.com/)!

🚀 High-performance server hooks, avoiding heavy per-connection events API ([why](https://bun.sh/docs/api/websockets#lcYFjkFYJC-summary))

📦 No external dependencies, includes [ws](https://github.com/websockets/ws) for Node.js support

💡 Extremely lightweight and tree-shakable packaging with ESM and CJS support

🔍 Developer-friendly object logging

> [!WARNING]
> This project and API are under development.

## Install

```sh
# npm
npm install crossws

# yarn
yarn add crossws

# pnpm
pnpm install crossws

# bun
bun install crossws
```

## Unified Hooks

CrossWS provides a cross-platform API to define WebSocket servers. An implementation with these hooks works across runtimes without needing you to go into details of any of them (while you always have the power to control low-level hooks). You can only define the life-cycle hooks that you only need and only those will be called run runtime.

> [!NOTE]
> For type support and IDE auto-completion, you can use `defineWebSocketHooks` utility or `WebSocketHooks` type export from the main.

```ts
import { defineWebSocketHooks } from "crossws";

const websocketHooks = defineWebSocketHooks({
  open(peer) {
    console.log("[ws] open", peer);
  },

  message(peer, message) {
    console.log("[ws] message", peer, message);
    if (message.text().includes("ping")) {
      peer.send("pong");
    }
  },

  close(peer, event) {
    console.log("[ws] close", peer, event);
  },

  error(peer, error) {
    console.log("[ws] error", peer, error);
  },

  // ... platform hooks such as bun:drain ...
});
```

### Peer Object

Websocket hooks always accept a peer instance as the first argument. `peer`, keeps the state of the connected client.

**Properties:**

- `peer.id?`: The peer address or unique id (might be `undefined`)
- `peer.readyState`: The connection status ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/readyState))
- `peer.ctx[name]`: Keeps the state of native client connection

**Methods:**

- `send(message, compress)`: Send a message to the connected client

> [!TIP]
> You can safely log a peer instance to the console using `console.log` it will be automatically stringified with useful information including the remote address and connection status!

### Message Object

on `message` hook, you receive a message object containing an incoming message from the client.

**Properties:**

- `message.rawData`: Raw message data
- `message.isBinary`: Indicates if the message is binary (might be `undefined`)

**Methods:**

- `message.text()`: Get stringified version of the message

> [!TIP]
> You can safely log `message` object to the console using `console.log` it will be automatically stringified!

## Error handling

You can catch errors using `error` hook. The second argument is error wrapped into a `WebSocketError` class.

## Universal WebSocket client

CrossWS also exposes a universal way to use [WebSocket](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket) API in order to connect to the server. For all runtimes, except Node.js, native implementation is used, and for Node.js, a bundled version of [`ws.WebSocket`](https://www.npmjs.com/package/ws) is bundled.

```js
import WebSocket from "crossws/websocket";
```

> [!NOTE]
> Using export conditions, the correct version will be always used so you don't have to worry about picking the right build!

## Integrations

CrossWS allows integrating your WebSocket hooks with different runtimes and platforms using built-in adapters. Each runtime has a specific method of integrating WebSocket. Once integrated, your custom hooks (such as `message` and `close`) will work consistently even if you change the runtime!

### Integration with **Node.js**

To integrate CrossWS with your Node.js HTTP server, you need to connect the `upgrade` event to the `handleUpgrade` method returned from the adapter. Behind the scenes, CrossWS uses an embedded version of [ws](https://github.com/websockets/ws).

```ts
// Initialize Server
import { createServer } from "node:http";

const server = createServer((req, res) => {
  res.end(
    `<script>new WebSocket("ws://localhost:3000").addEventListener('open', (e) => e.target.send("Hello from client!"));</script>`,
  );
}).listen(3000);

// Initialize WebSocket Hooks
import nodeWSAdapter from "crossws/adapters/node";

const { handleUpgrade } = nodeWSAdapter({ message: console.log });
server.on("upgrade", handleUpgrade);
```

**Node-specific hooks:**

- `node:open (peer)`
- `node:message (peer, data, isBinary)`
- `node:close (peer, code, reason)`
- `node:error (peer, error)`
- `node:ping (peer)`
- `node:pong (peer)`
- `node:unexpected-response (peer, req, res)`
- `node:upgrade (peer, req)`

See [playground/node.ts](./playground/node.ts) for demo and [src/adapters/node.ts](./src/adapters/node.ts) for implementation.

### Integration with **Bun**

To integrate CrossWS with your Bun server, you need to check for `server.upgrade` and also pass the `websocket` object returned from the adapter to server options. CrossWS leverages native Bun WebSocket API.

```ts
import bunAdapter from "./dist/adapters/bun";

const { websocket } = bunAdapter({ message: console.log });

Bun.serve({
  port: 3000,
  websocket,
  fetch(req, server) {
    if (server.upgrade(req)) {
      return;
    }
    return new Response(
      `<script>new WebSocket("ws://localhost:3000").addEventListener('open', (e) => e.target.send("Hello from client!"));</script>`,
      { headers: { "content-type": "text/html" } },
    );
  },
});
```

**Bun-specific hooks:**

- `bun:message (peer, ws,message)`
- `bun:open (peer, ws)`
- `bun:close (peer, ws)`
- `bun:drain (peer)`
- `bun:error (peer, ws, error)`
- `bun:ping (peer, ws, data)`
- `bun:pong (peer, ws, data)`

See [playground/bun.ts](./playground/bun.ts) for demo and [src/adapters/bun.ts](./src/adapters/bun.ts) for implementation.

### Integration with **Deno**

To integrate CrossWS with your Deno server, you need to check for the `upgrade` header and then call `handleUpgrade` method from the adapter passing the incoming request object. The returned value is the server upgrade response.

```ts
import denoAdapter from "crossws/adapters/deno";

const { handleUpgrade } = denoAdapter({ message: console.log });

Deno.serve({ port: 3000 }, (req) => {
  if (req.headers.get("upgrade") === "websocket") {
    return handleUpgrade(req);
  }
  return new Response(
    `<script>new WebSocket("ws://localhost:3000").addEventListener("open", (e) => e.target.send("Hello from client!"));</script>`,
    { headers: { "content-type": "text/html" } },
  );
});
```

**Deno-specific hooks:**

- `deno:open (peer)`
- `deno:message (peer, event)`
- `deno:close (peer)`
- `deno:error (peer, error)`

See [playground/deno.ts](./playground/deno.ts) for demo and [src/adapters/deno.ts](./src/adapters/deno.ts) for implementation.

### Integration with **Cloudflare Workers**

To integrate CrossWS with your Cloudflare Workers, you need to check for the `upgrade` header

```ts
import cloudflareAdapter from "crossws/adapters/cloudflare";

const { handleUpgrade } = cloudflareAdapter({ message: console.log });

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

**Cloudflare-specific hooks:**

- `cloudflare:accept(peer)`
- `cloudflare:message(peer, event)`
- `cloudflare:error(peer, event)`
- `cloudflare:close(peer, event)`

See [playground/cloudflare.ts](./playground/cloudflare.ts) for demo and [src/adapters/cloudflare.ts](./src/adapters/cloudflare.ts) for implementation.

### Integration with other runtimes

You can define your custom adapters using `defineWebSocketAdapter` wrapper.

See other adapter implementations in [./src/adapters](./src/adapters/) to get an idea of how adapters can be implemented and feel free to directly make a Pull Request to support your environment in CrossWS!

## Development

- Clone this repository
- Install the latest LTS version of [Node.js](https://nodejs.org/en/)
- Enable [Corepack](https://github.com/nodejs/corepack) using `corepack enable`
- Install dependencies using `pnpm install`
- Run interactive tests using `pnpm dev`

## License

Made with 💛

Published under [MIT License](./LICENSE).

<!-- Badges -->

[npm-version-src]: https://img.shields.io/npm/v/crossws?style=flat&colorA=18181B&colorB=F0DB4F
[npm-version-href]: https://npmjs.com/package/crossws
[npm-downloads-src]: https://img.shields.io/npm/dm/crossws?style=flat&colorA=18181B&colorB=F0DB4F
[npm-downloads-href]: https://npmjs.com/package/crossws
