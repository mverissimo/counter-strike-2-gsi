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
    cache: {
      scripts: true,
    },
    tasks: {
      build: "vp run -r build",
      lint: "vp lint",
      test: "vp test",
      check: "vp check",
    },
  },
});
