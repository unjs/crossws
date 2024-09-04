# Changelog


## v0.3.0

[compare changes](https://github.com/unjs/crossws/compare/v0.2.4...v0.3.0)

### 🚀 Enhancements

- **node, uws:** Automatically detect binary message type ([#53](https://github.com/unjs/crossws/pull/53))
- **peer:** Add `peer.close()` and `peer.terminate()` support ([#36](https://github.com/unjs/crossws/pull/36))
- Cloudflare durable objects support ([#54](https://github.com/unjs/crossws/pull/54))
- **deno:** Support pubsub ([#58](https://github.com/unjs/crossws/pull/58))
- Universal access to all peers ([#60](https://github.com/unjs/crossws/pull/60))
- Global publish ([#61](https://github.com/unjs/crossws/pull/61))
- Experimental sse adapter ([#62](https://github.com/unjs/crossws/pull/62))
- **peer:** Use secure lazy random uuid ([#64](https://github.com/unjs/crossws/pull/64))
- **sse:** Support bidirectional messaging ([#66](https://github.com/unjs/crossws/pull/66))
- **sse:** Implement `WebSocketSSE` peer ([#68](https://github.com/unjs/crossws/pull/68))
- ⚠️  Overhaul peer and message interface ([#70](https://github.com/unjs/crossws/pull/70))

### 🩹 Fixes

- Should not serailize binary messages ([#39](https://github.com/unjs/crossws/pull/39))
- **cloudflare-durable:** Restore peer url and id after hibernation ([#71](https://github.com/unjs/crossws/pull/71))

### 💅 Refactors

- ⚠️  Overhaul internal impl ([#55](https://github.com/unjs/crossws/pull/55))
- ⚠️  Move `peer.ctx` to `peer._internal` ([#59](https://github.com/unjs/crossws/pull/59))
- Rename internal crossws to hooks ([bb4c917](https://github.com/unjs/crossws/commit/bb4c917))
- Better internal organization ([2744f21](https://github.com/unjs/crossws/commit/2744f21))
- ⚠️  Remove adapter hooks ([#72](https://github.com/unjs/crossws/pull/72))

### 📖 Documentation

- **pubsub:** Correct typo ([#22](https://github.com/unjs/crossws/pull/22))
- Fix typo ([76fc105](https://github.com/unjs/crossws/commit/76fc105))
- Fix typos ([7dacb00](https://github.com/unjs/crossws/commit/7dacb00))
- Fix invalid link ([#46](https://github.com/unjs/crossws/pull/46))
- Fix link ([#45](https://github.com/unjs/crossws/pull/45))
- Fix link ([#44](https://github.com/unjs/crossws/pull/44))
- Update links to sources ([a96dca3](https://github.com/unjs/crossws/commit/a96dca3))
- Update contents ([898ab49](https://github.com/unjs/crossws/commit/898ab49))
- Update ([2e49cc3](https://github.com/unjs/crossws/commit/2e49cc3))

### 📦 Build

- Remove `uWebSockets.js` optional dependency ([#52](https://github.com/unjs/crossws/pull/52))
- Externalize `uWebSockets.js` ([b23b76d](https://github.com/unjs/crossws/commit/b23b76d))
- ⚠️  Esm-only build ([#63](https://github.com/unjs/crossws/pull/63))

### 🏡 Chore

- Fix typo ([#47](https://github.com/unjs/crossws/pull/47))
- Update deps ([60829ec](https://github.com/unjs/crossws/commit/60829ec))
- Update ci ([cc47af4](https://github.com/unjs/crossws/commit/cc47af4))
- Update to eslint v9 ([8d7cf40](https://github.com/unjs/crossws/commit/8d7cf40))
- Update examples ([44ef76a](https://github.com/unjs/crossws/commit/44ef76a))
- Update deps ([10e6427](https://github.com/unjs/crossws/commit/10e6427))
- Setup coverage report ([23fc41f](https://github.com/unjs/crossws/commit/23fc41f))
- Rename websocket native dist entry ([97c818e](https://github.com/unjs/crossws/commit/97c818e))
- Update play scripts ([4c6e8b3](https://github.com/unjs/crossws/commit/4c6e8b3))
- Update deps ([078b51d](https://github.com/unjs/crossws/commit/078b51d))
- Update docs lockfile ([dbf4f66](https://github.com/unjs/crossws/commit/dbf4f66))
- Update undocs ([440aabd](https://github.com/unjs/crossws/commit/440aabd))
- Update undocs ([13f8f7a](https://github.com/unjs/crossws/commit/13f8f7a))

### ✅ Tests

- Add adater tests ([#56](https://github.com/unjs/crossws/pull/56))
- **cloudflare:** Use random port for wrangler inspector ([a46265c](https://github.com/unjs/crossws/commit/a46265c))
- Run tests with web standard `WebSocket` and `EventSource` ([#67](https://github.com/unjs/crossws/pull/67))

#### ⚠️ Breaking Changes

- ⚠️  Overhaul peer and message interface ([#70](https://github.com/unjs/crossws/pull/70))
- ⚠️  Overhaul internal impl ([#55](https://github.com/unjs/crossws/pull/55))
- ⚠️  Move `peer.ctx` to `peer._internal` ([#59](https://github.com/unjs/crossws/pull/59))
- ⚠️  Remove adapter hooks ([#72](https://github.com/unjs/crossws/pull/72))
- ⚠️  Esm-only build ([#63](https://github.com/unjs/crossws/pull/63))

### ❤️ Contributors

- Pooya Parsa ([@pi0](http://github.com/pi0))
- Eduardo San Martin Morote ([@posva](http://github.com/posva))
- Alex ([@alexzhang1030](http://github.com/alexzhang1030))
- 39sho ([@39sho](http://github.com/39sho))
- @beer ([@iiio2](http://github.com/iiio2))
- Sébastien Chopin ([@atinux](http://github.com/atinux))
- Pierre Golfier <pro@pedraal.fr>

## v0.2.4

[compare changes](https://github.com/unjs/crossws/compare/v0.2.3...v0.2.4)

### 🚀 Enhancements

- Auto generated peer id ([a3b61f5](https://github.com/unjs/crossws/commit/a3b61f5))
- Basic pubsub support for node ([4bd61ca](https://github.com/unjs/crossws/commit/4bd61ca))

### 💅 Refactors

- Improve peer inspect message ([9f7e1f0](https://github.com/unjs/crossws/commit/9f7e1f0))

### 📖 Documentation

- Update content ([6d78e12](https://github.com/unjs/crossws/commit/6d78e12))

### 🏡 Chore

- Use seperate playground index ([889b37b](https://github.com/unjs/crossws/commit/889b37b))
- Update lockfile ([c119028](https://github.com/unjs/crossws/commit/c119028))
- Update docs ([54e0dca](https://github.com/unjs/crossws/commit/54e0dca))
- Update playground ([a6879bd](https://github.com/unjs/crossws/commit/a6879bd))
- Update example ([0ce11c5](https://github.com/unjs/crossws/commit/0ce11c5))
- Update playground ([cbeb472](https://github.com/unjs/crossws/commit/cbeb472))

### ❤️ Contributors

- Pooya Parsa ([@pi0](http://github.com/pi0))

## v0.2.3

[compare changes](https://github.com/unjs/crossws/compare/v0.2.2...v0.2.3)

### 🩹 Fixes

- **node:** Respect `x-forwarded` for client id ([3f8bd0c](https://github.com/unjs/crossws/commit/3f8bd0c))

### ❤️ Contributors

- Pooya Parsa ([@pi0](http://github.com/pi0))

## v0.2.2

[compare changes](https://github.com/unjs/crossws/compare/v0.2.1...v0.2.2)

### 🩹 Fixes

- **deno:** Pass info ([2c63b37](https://github.com/unjs/crossws/commit/2c63b37))

### 🏡 Chore

- **example:** Handle secure origins ([7f8639f](https://github.com/unjs/crossws/commit/7f8639f))

### ❤️ Contributors

- Pooya Parsa ([@pi0](http://github.com/pi0))

## v0.2.1

[compare changes](https://github.com/unjs/crossws/compare/v0.2.0...v0.2.1)

### 🩹 Fixes

- `$callHook` should check hook existence ([40082ba](https://github.com/unjs/crossws/commit/40082ba))

### 📖 Documentation

- Update usage to 0.2x ([db99a91](https://github.com/unjs/crossws/commit/db99a91))

### ❤️ Contributors

- Pooya Parsa ([@pi0](http://github.com/pi0))

## v0.2.0

[compare changes](https://github.com/unjs/crossws/compare/v0.1.3...v0.2.0)

### 💅 Refactors

- ⚠️  Improve types and api ([2ebacd3](https://github.com/unjs/crossws/commit/2ebacd3))

### 🏡 Chore

- Add new playground ([4e82c55](https://github.com/unjs/crossws/commit/4e82c55))
- Update playground ([ced76fa](https://github.com/unjs/crossws/commit/ced76fa))

#### ⚠️ Breaking Changes

- ⚠️  Improve types and api ([2ebacd3](https://github.com/unjs/crossws/commit/2ebacd3))

### ❤️ Contributors

- Pooya Parsa ([@pi0](http://github.com/pi0))

## v0.1.3

[compare changes](https://github.com/unjs/crossws/compare/v0.1.2...v0.1.3)

### 🏡 Chore

- Add build script to release ([6681afa](https://github.com/unjs/crossws/commit/6681afa))

### ❤️ Contributors

- Pooya Parsa ([@pi0](http://github.com/pi0))

## v0.1.2

[compare changes](https://github.com/unjs/crossws/compare/v0.1.1...v0.1.2)

### 🚀 Enhancements

- Support `uWebSockets.js ([b1de991](https://github.com/unjs/crossws/commit/b1de991))
- Allow access to peer url and headers ([b67bef0](https://github.com/unjs/crossws/commit/b67bef0))
- Dynamic resolver ([cb6721c](https://github.com/unjs/crossws/commit/cb6721c))
- Support upgrade hook to set headers ([91edb54](https://github.com/unjs/crossws/commit/91edb54))
- Pub/sub support for `bun` and `uws` ([a486f45](https://github.com/unjs/crossws/commit/a486f45))

### 💅 Refactors

- Use `@deno/types` ([0026087](https://github.com/unjs/crossws/commit/0026087))
- Use `crossws` interface to call hooks ([7e36eba](https://github.com/unjs/crossws/commit/7e36eba))
- Add `/adapters/uws` ([b51b01c](https://github.com/unjs/crossws/commit/b51b01c))

### 📖 Documentation

- Add link to play online ([ed41540](https://github.com/unjs/crossws/commit/ed41540))
- Migrate to unjs-docs structure v2 ([#13](https://github.com/unjs/crossws/pull/13))
- Update bun ([0c717d8](https://github.com/unjs/crossws/commit/0c717d8))

### 🏡 Chore

- Update examples ([a347e80](https://github.com/unjs/crossws/commit/a347e80))
- Initial docs ([2f3e983](https://github.com/unjs/crossws/commit/2f3e983))
- Add h3 example ([894792a](https://github.com/unjs/crossws/commit/894792a))
- Fix docs workspace root ([a607b89](https://github.com/unjs/crossws/commit/a607b89))
- Update docs ([5f72d42](https://github.com/unjs/crossws/commit/5f72d42))
- Update docs ([52c0e4f](https://github.com/unjs/crossws/commit/52c0e4f))
- Specify `uWebSockets.js` peer dep ([1ef0585](https://github.com/unjs/crossws/commit/1ef0585))

### ❤️ Contributors

- Pooya Parsa ([@pi0](http://github.com/pi0))

## v0.1.1

[compare changes](https://github.com/unjs/crossws/compare/v0.1.0...v0.1.1)

### 💅 Refactors

- Import bun types from @types/bun ([ba40b53](https://github.com/unjs/crossws/commit/ba40b53))

### 📦 Build

- Expose default export for compatibility types ([9934fb5](https://github.com/unjs/crossws/commit/9934fb5))

### 🏡 Chore

- Update lockfile ([53162bd](https://github.com/unjs/crossws/commit/53162bd))
- Update badges ([6e2b296](https://github.com/unjs/crossws/commit/6e2b296))

### ❤️ Contributors

- Pooya Parsa ([@pi0](http://github.com/pi0))

## v0.0.1


### 🏡 Chore

- Update readme ([af705a6](https://github.com/unjs/crossws/commit/af705a6))
- Don't gitignore manual `types` ([ec9330b](https://github.com/unjs/crossws/commit/ec9330b))

### ❤️ Contributors

- Pooya Parsa ([@pi0](http://github.com/pi0))

