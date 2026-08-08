import { defineConfig } from "vite-plus/pack";

export default defineConfig({
  // `derive` is a separate entry so the root export stays schema + types.
  // Consumers opt into the runtime helpers by importing the subpath.
  entry: ["src/index.ts", "src/derive/index.ts"],
  dts: {
    tsgo: true,
  },
  exports: true,
});
