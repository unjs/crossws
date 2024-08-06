import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    typecheck: { enabled: true },
    coverage: {
      include: ["src/**/*.ts"],
      exclude: [
        "src/websocket/*",
        "src/adapters/*",
        "!src/adapters/node.ts",
        "!src/adapters/uws.ts",
      ],
    },
  },
});
