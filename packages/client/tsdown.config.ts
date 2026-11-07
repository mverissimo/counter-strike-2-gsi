import { defineConfig } from "vite-plus/pack";

export default defineConfig({
  entry: ["src/index.ts", "src/transport.ts", "src/react.ts"],
  dts: {
    generator: "tsgo",
  },
  exports: true,
  // ...config options
});
