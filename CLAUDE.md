# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

pnpm workspace monorepo for a Counter-Strike 2 Game State Integration (GSI) stack. Workspace globs are `apps/*` and `packages/*` (see [pnpm-workspace.yaml](pnpm-workspace.yaml)); there is no `tools/` directory.

- [packages/types](packages/types) — arktype-backed schema for the raw GSI payload plus derived `EventMap`/`EventPayload`/`Delta` types. All auto-generated granular event names (e.g. `"player:state:health"`, `"allplayers:<steamid>:weapons:0:name"`) flow from `LeafPaths<SchemaPayload>`; change the schema here and consumers get new event keys automatically.
- [packages/server](packages/server) — `GSI` class ([packages/server/src/gsi.ts](packages/server/src/gsi.ts)). Validates payloads via `parsePayload`, merges state with `mergeDelta`, and dispatches through `Processor` + a typed `createEmitter`. Change-detection modes: `granular` (default; microdiff → per-path events), `block` (fast-deep-equal, top-level only), `minimal` (no block/granular events). `"update"`, `"error"`, and `"allplayers:joined"`/`"allplayers:left"` are emitted in every mode.
- [packages/handlers](packages/handlers) — runtime adapters for receiving GSI POSTs and fanning events out over SSE/WS. Parallel subtrees per runtime: `bun/`, `node/`, `hono/`, with shared logic in `core/`. Each runtime exposes `http.ts`, `sse.ts`, `ws.ts` behind a subpath export (`@counter-strike-2-gsi/handlers/node`, `/bun`, `/hono`); the root export ([packages/handlers/src/index.ts](packages/handlers/src/index.ts)) is runtime-free core types/helpers only, so `ws`/`hono` are never pulled in unless the matching subpath is imported.
- [packages/client](packages/client) — browser SSE/WS clients ([packages/client/src/hooks/use-gsi/clients](packages/client/src/hooks/use-gsi/clients)) plus a React integration ([packages/client/src/hooks/use-gsi/use-gsi.tsx](packages/client/src/hooks/use-gsi/use-gsi.tsx)) exporting `GSIProvider`, `useGSIClient`, `useGSIDelta`, `useGSIEvent`, `useGSISelector`, and `useGSIStatus`.
- [apps/website](apps/website) — Vite + vanilla TS app. Currently the default Vite template (not wired to the GSI client yet); `src/ui/player` and `src/ui/players` exist but are empty placeholders.
- [apps/backend](apps/backend) — placeholder directory (only `logs/` and `node_modules/`, no `package.json` or source). Don't treat it as a working example.

The server is transport-agnostic: create one `GSI` instance, feed raw payloads via `manager.update(raw)`, and attach any number of listeners with `manager.on(event, cb)`. Handlers in `packages/handlers` wire HTTP ingress + SSE/WS egress to that manager.

## Tooling

This repo uses **[vite-plus](https://voidzero.dev)** (`vp` CLI) for formatting, linting, testing, packing, and dev — not plain vite/vitest/eslint. Root `vite.config.ts` enables `typeAware` + `typeCheck` lint and wires `vp check --fix` as the staged-files hook.

- Node `>=22.12.0`, pnpm (version pinned via `packageManager` in [package.json](package.json); use pnpm, never npm/yarn).
- Shared dep versions come from the `catalog:` block in [pnpm-workspace.yaml](pnpm-workspace.yaml); prefer `"catalog:"` over pinned versions when adding dependencies.
- `vite` and `vitest` are aliased to `@voidzero-dev/vite-plus-core` / `@voidzero-dev/vite-plus-test` via workspace overrides.

## Commands

Workspace-wide (run from repo root):

- `pnpm ready` — `vp fmt && vp lint && vp test && vp run -r build`. Run this before calling work done.
- `pnpm dev` — runs the website dev server (`vp run website#dev`).
- `vp test` — all package tests (root-level; `vp run -r test` fails on packages without test files).
- `vp run -r build` — all package builds (`-r` must come before the task name).
- `vp fmt` / `vp lint` — format / lint the whole workspace.
- `pnpm clean` — nuke `dist` and `node_modules` across the workspace.

Per-package (inside a `packages/*` dir):

- `pnpm build` → `vp pack` (produces `dist/`).
- `pnpm dev` → `vp pack --watch`.
- `pnpm test` → `vp test`. Single file: `vp test path/to/file.test.ts`. Tests live under `src/__tests__`; shared fixtures live in [packages/server/tests/fixtures](packages/server/tests/fixtures).
- `pnpm typecheck` → `tsc --noEmit`.

Website ([apps/website](apps/website)): `pnpm dev` / `pnpm build` (`tsc && vp build`) / `pnpm preview`.

## Conventions worth knowing

- Packages ship ESM-only (`"type": "module"`, `exports: "./dist/index.mjs"`, types at `./dist/index.d.mts`). Don't add CJS entry points.
- Workspace deps use `"workspace:*"` — keep that form when adding cross-package imports.
- When adding a new GSI event, extend the schema in `packages/types/src/schema` rather than hand-typing events; `GeneratedEventMap` picks them up automatically.
- Change-detection mode is load-bearing: granular emits rich per-path deltas but runs microdiff on every update; `block` or `minimal` is the right choice for high-frequency (~64Hz) production HUDs.

## Working rules

- Read the full file before editing. Plan all changes, then make ONE complete edit. If you've edited a file 3+ times, stop and re-read the user's requirements.
- When stuck, summarize what you've tried and ask the user for guidance instead of retrying the same approach.

<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <script>`.
- [ ] If setup, runtime, or package-manager behavior looks wrong, run `vp env doctor` and include its output when asking for help.

<!--VITE PLUS END-->
