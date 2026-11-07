#!/usr/bin/env node
import { join } from "node:path";
import { parseArgs } from "node:util";
import { components, filename, installConfig, parseComponents, readConfig } from "./config";
import { configDirectory, resolveGame } from "./discovery";
import { verifyConnection } from "./verify";

const help = `Usage: cs2-gsi <install|verify> [options]

install  Create or update this CLI's GSI config, preserving unspecified settings.
verify   Wait for an authenticated CS2 payload using the installed config.

  --game-path <path>    CS2 root (Counter-Strike Global Offensive directory)
  --steam-path <path>   Steam root; scans its libraryfolders.vdf
  --uri <url>           GSI endpoint (default: http://127.0.0.1:3000/gsi)
  --components <list>   Comma-separated GSI components (default: all supported)
  --timeout <seconds>   Verification timeout (default: 60)
  --help               Show this help

Set CS2_GSI_TOKEN in the environment to supply/rotate the token on install.
Otherwise install generates a token once, then preserves it on updates.
Supported components: ${components.join(",")}

Restart CS2 after installation. Configure your server with the token in the CFG.
Stop your GSI server before verify; start it again afterward.
`;

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      "game-path": { type: "string" },
      "steam-path": { type: "string" },
      uri: { type: "string" },
      components: { type: "string" },
      timeout: { type: "string" },
      help: { type: "boolean" },
    },
  });
  if (values.help || !positionals.length) {
    console.log(help);
    return;
  }
  const [command] = positionals;
  if (positionals.length !== 1 || (command !== "install" && command !== "verify"))
    throw new Error("Expected install or verify. Use --help for usage.");
  if (command === "install" && values.timeout !== undefined)
    throw new Error("--timeout is only supported by verify.");
  if (command === "verify" && (values.uri !== undefined || values.components !== undefined))
    throw new Error(
      "verify uses the installed config. Use install to change --uri or --components.",
    );
  const game = await resolveGame(values["game-path"], values["steam-path"]);
  if (command === "install") {
    const token = process.env.CS2_GSI_TOKEN;
    const result = await installConfig(game, {
      ...(values.uri === undefined ? {} : { uri: values.uri }),
      ...(token === undefined ? {} : { token }),
      ...(values.components === undefined
        ? {}
        : { data: parseComponents(values.components.split(",").map((item) => item.trim())) }),
    });
    console.log(
      `${result.changed ? "Installed" : "Already up to date"}: ${result.path}\nUse the auth.token from this file in your GSI server. Restart CS2 to load the configuration.\nRun cs2-gsi verify before starting your server to test reception.`,
    );
  } else {
    const path = join(await configDirectory(game), filename);
    const config = await readConfig(path);
    if (!config) throw new Error("No managed config found. Run cs2-gsi install first.");
    await verifyConnection(config, Number(values.timeout ?? "60") * 1000, () => {
      console.log("Waiting for CS2. Open the game and enter a match or spectate...");
    });
    console.log(
      "Connection verified: received an authenticated CS2 payload. You can now start your GSI server.",
    );
  }
}

main().catch((error: unknown) => {
  console.error(`cs2-gsi: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
