import { defineConfig } from "vite-plus";

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  run: {
    tasks: {
      build: {
        command: "vp run -r build",
        output: ["packages/*/dist/**", "apps/*/dist/**"],
      },
      lint: "vp lint",
      test: "vp test",
      check: "vp check",
    },
  },
});
