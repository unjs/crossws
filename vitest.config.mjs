import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    typecheck: { enabled: true },
    coverage: {
      include: ["src/**/*.ts"],
      // Runtime-specific code that Node tests can't execute: the WebSocket
      // client shims, and every adapter except the two exercised here.
      // Written as one extglob rather than `"src/adapters/*"` plus
      // `"!src/adapters/node.ts"` re-includes — a `!` entry anywhere in
      // `exclude` flips the list into "exclude everything else", which
      // silently dropped *all* files and reported 0/0.
      exclude: ["src/websocket/**", "src/adapters/!(node|uws).ts"],
    },
  },
});
