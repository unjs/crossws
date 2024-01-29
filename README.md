# ⛨ CrossWS

[![npm version][npm-version-src]][npm-version-href]
[![bundle][bundle-src]][bundle-href]

<!-- [![npm downloads][npm-downloads-src]][npm-downloads-href] -->

<!-- [![Codecov][codecov-src]][codecov-href] -->

> [!WARNING]
> This project and API are under heavy development and trial. Please don't rely on it for production yet. Feedback is more than welcome!

Cross-platform WebSocket Servers:

👉 Elegant, typed, and simple interface to implement platform-agnostic WebSocket servers

🚀 High-performance server hooks, avoiding heavy per-connection events API ([why](https://bun.sh/docs/api/websockets#lcYFjkFYJC-summary))

📦 No external dependencies, includes [ws](https://github.com/websockets/ws) types and Node.js support

🔗 Seamlessly integrates with, [Node.js](https://nodejs.org/en), [Bun](https://bun.sh/), [Deno](https://deno.com/) and [Cloudflare Workers](https://workers.cloudflare.com/)!

💡 Extremely lightweight and tree-shakable packaging with ESM and CJS support

🔍 Developer-friendly logs

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

## Integration

CrossWS allows integrating your WebSocket hooks with different runtimes and platforms using built-in adapters. Each runtime has a specific method of integrating WebSocket. Once integrated, your custom hooks (such as `onMessage`) will work consistently even if you change the runtime!

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

const { handleUpgrade } = nodeWSAdapter({ onMessage: console.log });
server.on("upgrade", handleUpgrade);
```

See [playground/node.ts](./playground/node.ts) for demo and [src/adapters/node.ts](./src/adapters/node.ts) for implementation.

### Integration with **Bun**

To integrate CrossWS with your Bun server, you need to check for `server.upgrade` and also pass the `websocket` object returned from the adapter to server options. CrossWS leverages native Bun WebSocket API.

```ts
import bunAdapter from "./dist/adapters/bun";

const { websocket } = bunAdapter({ onMessage: console.log });

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

See [playground/bun.ts](./playground/bun.ts) for demo and [src/adapters/bun.ts](./src/adapters/bun.ts) for implementation.

### Integration with **Deno**

To integrate CrossWS with your Deno server, you need to check for the `upgrade` header and then call `handleUpgrade` method from the adapter passing the incoming request object. The returned value is the server upgrade response.

```ts
import denoAdapter from "crossws/adapters/deno";

const { handleUpgrade } = denoAdapter({ onMessage: console.log });

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

See [playground/deno.ts](./playground/deno.ts) for demo and [src/adapters/deno.ts](./src/adapters/deno.ts) for implementation.

### Integration with **Cloudflare Workers**

To integrate CrossWS with your Cloudflare Workers, you need to check for the `upgrade` header

```ts
import cloudflareAdapter from "crossws/adapters/cloudflare";

const { handleUpgrade } = cloudflareAdapter({ onMessage: console.log });

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

See [playground/cloudflare.ts](./playground/cloudflare.ts) for demo and [src/adapters/cloudflare.ts](./src/adapters/cloudflare.ts) for implementation.

### Integration with other runtimes

You can define your custom adapters using `defineWebSocketAdapter` wrapper.

See other adapter implementations in [./src/adapters](./src/adapters/) to get an idea of how adapters can be implemented and feel free to directly make a Pull Request to support your environment in CrossWS!

## Hooks API

Previously you saw in the adapter examples that we pass `onMessage` option.

The first object passed to adapters is a list of global hooks that will get called during the lifecycle of a WebSocket connection. You can use `defineWebSocketHooks` utility to make a typed WebSocket hooks object and pass it to the actual adapter when needed.

**Note: API is subject to change! Feedbacks Welcome!**

```ts
import { defineWebSocketHooks } from "crossws";

const websocketHooks = defineWebSocketHooks({
  onMessage: (peer, message) => {
    console.log("message", peer, message);
    if (message.text().includes("ping")) {
      peer.send("pong");
    }
  },
  onError: (peer, error) => {
    console.log("error", peer, error);
  },
  onOpen: (peer) => {
    console.log("open", peer);
  },
  onClose: (peer, code, reason) => {
    console.log("close", peer, code, reason);
  },
  onEvent: (event, ...args) => {
    console.log("event", event);
  },
});
```

### `WebSocketPeer`

Websocket hooks methods accept a peer instance as the first argument. peer is a wrapper over platform natives WebSocket connection instance and allows to send messages.

**Tip:** You can safely log a peer instance to the console using `console.log` it will be automatically stringified with useful information including the remote address and connection status!

### `WebSocketMessage`

The second argument to `onMessage` event hooks is a message object. You can access raw data using `message.rawData` or stringified message using `message.text()`.

**Tip:** You can safely log `message` object to the console using `console.log` it will be automatically stringified!

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
[codecov-src]: https://img.shields.io/codecov/c/gh/unjs/crossws/main?style=flat&colorA=18181B&colorB=F0DB4F
[codecov-href]: https://codecov.io/gh/unjs/crossws
[bundle-src]: https://img.shields.io/bundlephobia/minzip/crossws?style=flat&colorA=18181B&colorB=F0DB4F
[bundle-href]: https://bundlephobia.com/result?p=crossws
