# @counter-strike-2-gsi/cli

Install and verify native CS2 Game State Integration on the machine running the game. Requires Node >=22.12.0. Windows Steam and Linux Steam (including the standard Flatpak location) are supported discovery targets. Additional libraries are read from Steam's `libraryfolders.vdf` and CS2's app manifest. Use `--steam-path` for a custom Steam installation or `--game-path` to bypass discovery.

## From this repository

```bash
pnpm install
pnpm --filter @counter-strike-2-gsi/cli build
node packages/cli/dist/cli.mjs install
node packages/cli/dist/cli.mjs verify
```

Once the package is published, the equivalent commands are:

```bash
pnpm dlx @counter-strike-2-gsi/cli install
pnpm dlx @counter-strike-2-gsi/cli verify
```

For manual discovery or a different receiver:

```bash
node packages/cli/dist/cli.mjs install --game-path "/path/to/Counter-Strike Global Offensive" --uri http://127.0.0.1:3000/gsi
node packages/cli/dist/cli.mjs verify --game-path "/path/to/Counter-Strike Global Offensive" --timeout 90
```

`--game-path` points to the game root containing `game/csgo/cfg`, not to the CFG directory itself. Multiple detected installations require an explicit selection. This CLI does not create a missing game directory.

## Configuration and updates

`install` writes only `game/csgo/cfg/gamestate_integration_counter_strike_2_gsi.cfg`. Other integrations remain untouched; if they use the same endpoint, remove the duplicate manually to avoid duplicate events. Existing files at the managed filename without the CLI's format marker, and symlinks, are refused.

The first install defaults to `http://127.0.0.1:3000/gsi`, generates a random authentication token, and enables all supported components. Set `CS2_GSI_TOKEN` in the environment before installing to use your server's existing token or rotate it. Tokens are never printed. Read `auth.token` from the generated CFG and configure your receiver with that value (for example, `createGSINode({ manager, token })`). Treat the CFG as a secret; new files use owner-only permissions on POSIX systems.

Rerun `install` to update. Omitted options preserve the current endpoint, token, and component selection; an identical config is left untouched. Managed updates replace the file atomically. Restart CS2 after changes. No launch parameters or HLAE/mirv installation are needed for this native GSI setup.

Use `--components provider,map,round,player_id,player_state` to select data. Run `--help` for the full list. The defaults match the repository's GSI quick start, with buffer/throttle `0.1`, heartbeat `10.0`, and timeout `5.0` seconds. Observer-only components such as `allplayers_*`, `bomb`, and `grenades` depend on the game mode and spectator access.

## Verify the connection

Stop your HUD/GSI receiver first, run `verify`, then open or restart CS2 and enter a match or spectate. The command temporarily listens at the installed endpoint and exits successfully after a POST with the configured token and CS2 provider metadata (`appid: 730` and a numeric timestamp). It times out after 60 seconds by default and exits with status 1 on errors. Invalid requests do not count as a successful connection. After verification exits, start your normal receiver again.

Verification requires the `provider` component and a local HTTP endpoint on `127.0.0.1`, `localhost`, or `[::1]`. For remote or HTTPS receivers, inspect the receiver's logs instead. This checks delivery from the game to a temporary receiver; it does not validate your production server or the HUD's SSE/WebSocket connection. An occupied port produces an actionable error rather than interrupting the existing process.

## Recovery and diagnostics

Explicit install options can repair invalid values in an existing managed CFG (for example, `install --uri http://127.0.0.1:3000/gsi` replaces an invalid endpoint). The resulting configuration must pass validation before writing. Syntax errors and unmanaged files are still refused. UTF-8 BOM and LF/CRLF line endings are accepted.

Steam discovery reports unreadable or malformed manifests and continues searching other libraries. If no installation is found, use `--game-path` to select the game directly.

## Development checks

`pnpm --filter @counter-strike-2-gsi/cli test` runs the behavior tests. `pnpm --filter @counter-strike-2-gsi/cli typecheck` checks the package with TypeScript. CI runs the workspace checks, tests, and builds on Ubuntu. These checks use temporary fixtures; a real Steam/CS2 installation remains a separate integration check.
