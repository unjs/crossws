import { defineBuildConfig } from "unbuild";

export default defineBuildConfig({
  rollup: {
    inlineDependencies: true,
  },
  externals: ["@cloudflare/workers-types", "bun-types"],
});
