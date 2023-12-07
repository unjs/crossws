# ⛨ CrossWS

[![npm version][npm-version-src]][npm-version-href]
[![bundle][bundle-src]][bundle-href]

<!-- [![npm downloads][npm-downloads-src]][npm-downloads-href] -->

<!-- [![Codecov][codecov-src]][codecov-href] -->

> [!WIP]
> This project and API is under heavy development and opened to test integrations. Don't rely on it for production yet. Feedbacks welcome about API design!

Cross-platform WebSocket server adapters:

- Elegant, typed and simple interface to define WebSocket handlers
- Performant per-server handlers instead of per-connection events api ([why](https://bun.sh/docs/api/websockets#lcYFjkFYJC-summary))
- Zero dependencies with bundled [ws](https://github.com/websockets/ws) types and runtime for [Node.js](https://nodejs.org/) support
- Native integration with [Bun](https://bun.sh/) and [Deno](https://deno.com/) WebSocket API
- Super lightweight tree-shakable packaging
- Developer-Friendly logging

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

CrossWS allows integrating your WebSocket handlers with different runtimes and platforms using built-in adapters. Each runtime has specific method of integrating WebSocket. Once integrated, your custom handlers (such as `onMessage`) will work consitent even if you change the runtime!

### Integration with **Node.js**

In order to integrate crosws with your Node.js HTTP server, you need to connect `upgrade` event to `handleUpgrade` method returned from adapter. Behind the scenes CrossWS uses an embdeded version of [ws](https://github.com/websockets/ws).

```ts
// Initialize Server
import { createServer } from "node:http";

const server = createServer((req, res) => {
  res.end(
    `<script>new WebSocket("ws://localhost:3000").addEventListener('open', (e) => e.target.send("Hello from client!"));</script>`,
  );
}).listen(3000);

// Initialize WebSocket Handler
import nodeWSAdapter from "crossws/adapters/node";

const { handleUpgrade } = nodeWSAdapter({ onMessage: console.log });
server.on("upgrade", handleUpgrade);
```

See [playground/node.ts](./playground/node.ts) for demo and [src/adapters/node.ts](./src/adapters/node.ts) for implementation.

## Integration with **Bun**

In order to integrate crosws with your Bun server, you need to check for `server.upgrade` and also pass `websocket` object returned from adapter to server options. CrossWS leverages native Bun WebSocket API.

```ts
import bunAdapter from "./dist/adapters/bun";

const { websocket } = bunAdapter({ onMessage: console.log });

Bun.serve({
  port: 3000,
  fetch(req, server) {
    if (server.upgrade(req)) {
      return;
    }
    return new Response(
      `<script>new WebSocket("ws://localhost:3000").addEventListener('open', (e) => e.target.send("Hello from client!"));</script>`,
      { headers: { "content-type": "text/html" } },
    );
  },
  websocket,
});
```

See [playground/bun.ts](./playground/bun.ts) for demo and [src/adapters/bun.ts](./src/adapters/bun.ts) for implementation.

## Integration with **Deno**

In order to integrate crosws with your Deno server, you need to check for `upgrade` header than then call `handleUpgrade` method from adapter passing the incoming request object. Returned value is server upgrade response.

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

## Integration with other runtimes

You can define your custom adapters using `defineWebSocketAdapter` wrapper.

See other adapter implementations in [./src/adapters](./src/adapters/) to get and idea how adapters can be implemented and feel free to directly make a Pull Request to support your environment in CrossWS!

## Handler API

Previously you saw in the adapter examples that we pass `onMessage` option.

First object passed to adapters is a list of global handlers that will get called during lifecycle of a WebSocket connection. You can use `defineWebSocketHandler` utility to make a typed websocket handler object and pass it to the actual adapter when needed.

**Note: API is subject to change! Feedbacks Welcome!**

```ts
import { defineWebSocketHandler } from "crossws";

const websocketHandler = defineWebSocketHandler({
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

Websocket handler methods accept a peer instance as first argument. peer is a wrapper over platform natives WebSocket connection instance and alows to send message.

**Tip:** You can safely log a peer instance to console using `console.log` it will be automatically stringified with useful information including remote address and connection status!

### `WebSocketMessage`

Second argument to `onMessage` event handler is a message object. You can access raw data using `message.rawData` or stringified message using `message.text()`.

**Tip:** You can safely log `message` object to console using `console.log` it will be automatically stringified!

## Development

- Clone this repository
- Install latest LTS version of [Node.js](https://nodejs.org/en/)
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
