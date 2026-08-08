import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite-plus";

/**
 * The GSI server runs as its own process on :3000 in development, exactly as
 * it does in production — `pnpm dev` starts both it and Vite. Proxying keeps
 * the browser on a single origin, so `EventSource` needs no CORS headers and
 * the page can request `/sse` relatively.
 *
 * The upside of developing against the real server rather than an in-process
 * dev-only mount: `server/standalone.ts` is the process shipped to OBS, so it
 * is exercised on every dev run instead of only at ship time. CS2's config
 * points at :3000 in both cases and never has to change.
 */
/**
 * Loaded with an empty prefix so `PORT` is visible here and not just the
 * `VITE_`-prefixed vars: `PORT` in `.env` moves the GSI server that Bun
 * starts, and a proxy still pointing at 3000 is a blank overlay with a
 * healthy-looking terminal on both sides. The proxy is a development-only
 * concern, hence the fixed mode. `GSI_SERVER_URL` wins over both, for a GSI
 * server on another host.
 */
const env = { ...loadEnv("development", import.meta.dirname, ""), ...process.env };
const GSI_SERVER = env.GSI_SERVER_URL ?? `http://localhost:${env.PORT ?? 3000}`;

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/gsi": GSI_SERVER,
      "/sse": GSI_SERVER,
    },
  },
  // Relative asset URLs so the built overlay also works when OBS loads
  // `dist/index.html` straight off disk as a local file.
  base: "./",
  test: {
    environment: "happy-dom",
  },
});
