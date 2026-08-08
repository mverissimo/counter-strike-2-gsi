import { networkInterfaces } from "node:os";

import { createOverlayGSI, GSI_PATH, SSE_PATH } from "./manager.ts";

const PORT = Number(process.env.PORT ?? 3000);

// Trailing slash matters: `new URL(rel, DIST)` resolves against the directory,
// not against a sibling of it.
const DIST = new URL("../dist/", import.meta.url);

/**
 * CS2 is Windows-only, so under WSL the game and this server are on opposite
 * sides of a NAT boundary: the game's `127.0.0.1` is Windows' loopback, not
 * this one. Unless WSL is in mirrored networking mode, CS2 has to be pointed
 * at the distro's address instead — and that address changes on every
 * `wsl --shutdown`, which turns a working overlay into a silently blank one.
 *
 * Printing it at startup means the value CS2 needs is always in front of you.
 */
async function wslAddress() {
  if (
    !(
      await Bun.file("/proc/version")
        .text()
        .catch(() => "")
    )
      .toLowerCase()
      .includes("microsoft")
  ) {
    return undefined;
  }

  for (const addrs of Object.values(networkInterfaces())) {
    for (const addr of addrs ?? []) {
      if (addr.family === "IPv4" && !addr.internal) {
        return addr.address;
      }
    }
  }

  return undefined;
}

/**
 * Serves the built overlay so OBS can point at this one origin. `Bun.file` is
 * lazy — the body streams straight from disk and content types come from the
 * extension, so there is no MIME table to maintain.
 *
 * Deliberately minimal; put a real static server in front of it if this ever
 * leaves localhost.
 */
function serveStatic(pathname: string) {
  const target = new URL(pathname === "/" ? "index.html" : `.${pathname}`, DIST);

  // URL resolution collapses `..`, so a crafted path can land outside dist.
  // Compare the resolved href against the root rather than trusting the input.
  if (!target.href.startsWith(DIST.href)) {
    return new Response("Forbidden", { status: 403 });
  }

  const file = Bun.file(target);

  return file
    .exists()
    .then((found) => (found ? new Response(file) : new Response("Not Found", { status: 404 })));
}

const { gsi } = createOverlayGSI();

/**
 * "Is CS2 actually reaching me?" is the first question worth answering when
 * the overlay is blank, and a silent 200 does not answer it. Announce the
 * first payload and then get out of the way — logging every tick would be
 * hundreds of lines a minute.
 */
let ingested = 0;

let server: ReturnType<typeof Bun.serve>;

try {
  server = Bun.serve({
    port: PORT,

    // `gsi.routes` is already in Bun's native shape; the only reason to unpack
    // the GSI route is the first-payload log.
    routes: {
      ...gsi.routes,
      [GSI_PATH]: {
        POST: (req: Request) => {
          if (ingested++ === 0) {
            console.log(
              `[gsi] first payload received from ${server.requestIP(req)?.address} — CS2 is connected`,
            );
          }

          return gsi.gsiHandler(req);
        },
      },
    },

    fetch: (req) => serveStatic(new URL(req.url).pathname),
  });
} catch (err) {
  // A busy port is the one failure worth spelling out. Under `pnpm dev` this
  // runs behind `bun --watch`, which parks after a failed start and only
  // retries on a file change — so without this you get a raw stack trace,
  // Vite keeps serving, and the overlay sits on "no signal" against a GSI
  // server that never came up.
  if ((err as { code?: string }).code !== "EADDRINUSE") {
    throw err;
  }

  console.error(
    `\n[gsi] port ${PORT} is already in use — another GSI server is still running.\n` +
      `[gsi]   find it:  ss -ltnp | grep :${PORT}\n` +
      `[gsi]   or use:   PORT=3001 pnpm dev  (and update the uri in your CS2 cfg)\n` +
      `[gsi] Nothing is ingesting payloads until this is resolved.\n`,
  );

  process.exit(1);
}

console.log(`[gsi] ingest  POST http://localhost:${PORT}${GSI_PATH}  <- point CS2 here`);
console.log(`[gsi] stream  GET  http://localhost:${PORT}${SSE_PATH}`);
console.log(`[gsi] page         http://localhost:${PORT}  (serves dist/ once built)`);

const wsl = await wslAddress();

if (wsl) {
  console.log(
    `\n[gsi] WSL detected. CS2 runs on Windows and cannot reach this "127.0.0.1".\n` +
      `[gsi]   set "uri" in your CS2 cfg to:  http://${wsl}:${PORT}${GSI_PATH}\n` +
      `[gsi]   this address changes on 'wsl --shutdown' — re-check it here after one.\n` +
      `[gsi]   permanent fix: networkingMode=mirrored in %USERPROFILE%\\.wslconfig\n`,
  );
}

// Until that first payload lands, say so periodically. A blank overlay plus a
// silent terminal is the state that wastes the most time; on WSL it usually
// means CS2 is posting to Windows' loopback, which is a different machine from
// this one's.
const waiting = setInterval(() => {
  if (ingested > 0) {
    clearInterval(waiting);

    return;
  }

  console.log(`[gsi] no payloads yet — nothing has POSTed to ${GSI_PATH}`);
}, 15_000);

waiting.unref();
