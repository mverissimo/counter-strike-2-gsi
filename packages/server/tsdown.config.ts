import { defineConfig } from "vite-plus/pack";

export default defineConfig({
  dts: {
    generator: "tsgo",
  },
  exports: true,
  // ...config options
});
