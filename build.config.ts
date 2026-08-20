import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { defineBuildConfig } from "obuild/config";
import { minify } from "rolldown/utils";
import type { Plugin } from "rolldown";

const adapters = ["bun", "bunny", "cloudflare", "deno", "node", "sse", "uws", "vercel"];

const servers = ["bun", "bunny", "cloudflare", "default", "deno", "node"];

export default defineBuildConfig({
  entries: [
    {
      type: "bundle",
      input: [
        "src/index.ts",
        "src/sync.ts",
        "src/websocket/native.ts",
        "src/websocket/node.ts",
        "src/websocket/deno.ts",
        "src/websocket/bun.ts",
        "src/websocket/sse.ts",
        ...adapters.map((id) => `src/adapters/${id}.ts`),
        ...servers.map((id) => `src/server/${id}.ts`),
      ],
      rolldown: {
        plugins: [minifyLibsPlugin()],
        external: [
          "@cloudflare/workers-types",
          "bun",
          "@deno/types",
          "uWebSockets.js",
          "cloudflare:workers",
          // Keep the self-referential `crossws/websocket` import as a bare
          // specifier in the output so the consumer's runtime/bundler resolves
          // it via the package `exports` conditions — letting a per-runtime
          // bundle tree-shake the other runtimes' clients (e.g. `ws` out of
          // a Deno or browser build).
          "crossws/websocket",
        ],
      },
    },
  ],
  hooks: {
    async end(ctx) {
      // Generate declaration files for each entry point (old TS compatibility)
      const entries = Object.keys(ctx.pkg.exports || {})
        .filter((key) => key.startsWith("./"))
        .map((key) => key.slice(2));
      for (const entry of entries) {
        const dst = join(ctx.pkgDir, entry + ".d.ts");
        await mkdir(dirname(dst), { recursive: true });
        let relativePath = ("..".repeat(entry.split("/").length - 1) || ".") + `/dist/${entry}`;
        if (entry === "websocket") {
          relativePath += "/native";
        } else if (entry === "server") {
          relativePath += "/node";
        }
        await writeFile(
          dst,
          `export * from "${relativePath}.mjs";\nexport { default } from "${relativePath}.mjs";\n`,
          "utf8",
        );
      }
    },
  },
});

/**
 * Minify the vendored dependency chunks obuild emits under `dist/_chunks/libs/`
 * (currently only `ws`). Our own sources are left readable.
 *
 * This runs in `generateBundle` rather than `renderChunk` because obuild's
 * `dce-only` minifier re-prints chunks after `renderChunk`, which would restore
 * the whitespace we just removed.
 */
function minifyLibsPlugin(): Plugin {
  return {
    name: "crossws:minify-libs",
    async generateBundle(_outputOptions, bundle) {
      for (const [fileName, chunk] of Object.entries(bundle)) {
        if (
          chunk.type !== "chunk" ||
          !fileName.startsWith("_chunks/libs/") ||
          !fileName.endsWith(".mjs")
        ) {
          continue;
        }
        const res = await minify(fileName, chunk.code, { module: true });
        const errors = res.errors.filter((e) => e.severity === "Error");
        if (errors.length > 0) {
          throw new Error(
            `Failed to minify ${fileName}:\n${errors.map((e) => e.message).join("\n")}`,
          );
        }
        chunk.code = res.code;
      }
    },
  };
}
