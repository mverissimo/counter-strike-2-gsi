import { defineConfig } from "vite-plus/pack";

export default defineConfig({
  entry: ["src/index.ts", "src/node/index.ts", "src/bun/index.ts", "src/hono/index.ts"],
  deps: {
    neverBundle: ["bun"],
  },
  dts: {
    generator: "tsgo",
  },
  exports: true,
  // ...config options
});
