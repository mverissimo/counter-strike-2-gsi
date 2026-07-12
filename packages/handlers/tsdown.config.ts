import { defineConfig } from "vite-plus/pack";

export default defineConfig({
  entry: ["src/index.ts", "src/node/index.ts", "src/bun/index.ts", "src/hono/index.ts"],
  external: ["bun"],
  dts: {
    tsgo: true,
  },
  exports: true,
  // ...config options
});
