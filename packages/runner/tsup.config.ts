import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  // Bundle workspace packages so we don't need symlinks at runtime
  noExternal: ["@cmax/core", "@cmax/games", "@cmax/agents"],
});
