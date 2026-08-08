# CS2 GSI Example Overlay

A stream overlay built on the packages in this repo. It renders a scoreboard,
round history, both team rosters, the observed player's vitals and weapon, and
a bomb timer — driven by a live Game State Integration feed.

It is a working reference for wiring the three packages together:

| Package                          | Role here                                     |
| -------------------------------- | --------------------------------------------- |
| `@counter-strike-2-gsi/server`   | validates + merges payloads, emits events     |
| `@counter-strike-2-gsi/handlers` | receives CS2's POSTs, fans state out over SSE |
| `@counter-strike-2-gsi/client`   | `GSIProvider` + hooks in the browser          |

## Run it

```bash
pnpm install
pnpm --filter website dev      # page on :5173, GSI server on :3000
```

`dev` starts two processes: the GSI server ([server/standalone.ts](server/standalone.ts))
on `:3000`, and Vite on `:5173` with `/gsi` and `/sse`
[proxied](vite.config.ts) to it. The proxy keeps the browser on one origin, so
`EventSource` needs no CORS headers.

Two processes rather than a dev-only in-process mount, because `standalone.ts`
is the same process you ship to OBS — developing against it means it is
exercised on every run instead of only at ship time, and CS2's config points at
`:3000` in both cases. `bun --watch` restarts it on edits; the browser client
reconnects on its own.

The server runs on [Bun](https://bun.sh) — `createGSIBun` hands back routes in
Bun's native shape, so `Bun.serve({ routes })` is the whole wiring, and
`Bun.file` covers static serving without a MIME table. The same manager works
on Node or Hono by swapping the import; see
[packages/handlers](../../packages/handlers).

### Without CS2

The mock feeder posts payloads; it does not host anything. Leave `dev` running
and start it in a second terminal:

```bash
pnpm --filter website mock
```

Feeds a synthetic match — 10 players, rounds, bomb plants, kills — at the same
10 Hz CS2 uses. Open <http://localhost:5173/?debug> to see the overlay against a
backdrop instead of the transparent default.

`cannot reach http://localhost:3000/gsi` means nothing is listening on `:3000`
— the server is not running. `pnpm --filter website dev:gsi` starts it alone if
you don't want the page.

### With CS2

1. Copy [cs2/gamestate_integration_overlay.cfg](cs2/gamestate_integration_overlay.cfg)
   into your `csgo/cfg/` directory (paths are in the file's header).
2. Restart CS2. It only reads GSI configs at launch.

There is no auth token, deliberately. The endpoint is loopback-only and the one
thing that should reach it is CS2 on the same machine, so a shared secret
between two local processes adds no safety — and it adds a genuinely nasty
failure mode: a mismatch is a bare `401` in the terminal and a blank overlay in
the browser, with nothing on screen connecting the two.

The handler supports one when you need it. Pass `token` to `createGSIBun` in
[server/manager.ts](server/manager.ts) and add a matching block to the cfg:

```
"auth" { "token" "your-token" }
```

Do that before the endpoint is reachable beyond localhost, where it stops being
optional.

#### On WSL

CS2 is Windows-only, so if the server runs in WSL the two are on opposite sides
of a NAT boundary and `127.0.0.1` in your cfg points at Windows' loopback — not
at the distro. CS2 posts into the void and the overlay stays blank, with no
error anywhere, because nothing ever reaches the server.

The server detects this and prints the address to use:

```
[gsi] WSL detected. CS2 runs on Windows and cannot reach this "127.0.0.1".
[gsi]   set "uri" in your CS2 cfg to:  http://172.18.81.196:3000/gsi
```

That address changes on every `wsl --shutdown`, so re-check it after one. To
stop caring, put `networkingMode=mirrored` under `[wsl2]` in
`%USERPROFILE%\.wslconfig` (Windows 11 build 22621+) and restart WSL —
`127.0.0.1` then works in both directions and the cfg never needs touching.

To confirm which side is broken, run this **from Windows**, not from WSL:

```powershell
curl.exe -X POST http://127.0.0.1:3000/gsi -H "Content-Type: application/json" -d "{}"
```

A connection failure is the NAT boundary. A `200` means networking is fine and
the problem is the cfg — wrong path, missing `gamestate_integration_` prefix,
or CS2 not restarted since you edited it.

The full roster (`allplayers`) is **spectator/GOTV only** — in a normal match
you get your own `player` block and nothing else, so the two roster columns
will be empty. That is CS2's restriction, not the library's.

### In OBS

```bash
pnpm --filter website build
pnpm --filter website serve    # http://localhost:3000, page + ingest
```

Add a **Browser Source** pointing at `http://localhost:3000`, 1920x1080. The
page's body is transparent, so only the widgets composite over your game
capture. Same port as development, so the `.cfg` needs no change.

## How the data flows

The overlay reads the stream at two different levels, and the split is the main
thing worth copying:

**Snapshot — what to render.** [overlay.tsx](src/overlay.tsx) calls
`useGSIState()` once, then hands each widget the primitives it draws. Every
widget is `memo`'d, so a tick that only moves someone's ammo re-renders the
player panel and nothing else.

This is deliberate. A granular event like `player:state:health` fires only when
that path _changes_, and an overlay is loaded mid-match — OBS starts the browser
source whenever the scene loads, long after the map name last moved. `"update"`
carries the whole merged state and is what the SSE handler replays to a new
connection, so building from it is what makes the overlay paint on the first
frame instead of filling in field by field.

**Granular deltas — transitions to react to.**
[bomb-timer.tsx](src/components/bomb-timer/bomb-timer.tsx) uses
`useGSIDelta("bomb:state")` to fire its plant flash. `{ previous, current }` is
the only thing that identifies the _edge_; polling the snapshot cannot tell
"just planted" from "planted 20 seconds ago".

The events the server forwards are declared once in
[src/lib/events.ts](src/lib/events.ts), which `server/manager.ts` hands to the
handler. The handler can only fan out names it was told about up front, so a
hook subscribing to a name that is not on that list silently receives nothing —
add the name there first. The list stays trimmed to what has a subscriber:
every granular name on it registers a listener, and that is what makes the
server microdiff the block underneath it on each tick.

## How the styles are organised

No CSS framework. A HUD is a handful of visually bespoke widgets with heavy
conditional state, not many structurally-similar layouts, so a utility
vocabulary buys little and the class strings get rebuilt on every tick.

- **[src/styles/tokens.css](src/styles/tokens.css)** — every shared value:
  colours, timings, radii, and the one `font-size` line that rescales the whole
  1920x1080 canvas to any browser-source size (everything else is in `rem`).
- **[src/styles/global.css](src/styles/global.css)** — reset plus the rules
  that make this an overlay: transparent body, no scrolling, no cursor.
- **`*.module.css` next to each component** — scoped by CSS Modules, so no
  naming convention to maintain and no chance of a collision. Native nesting,
  `color-mix()`, and custom properties cover what a preprocessor used to be
  needed for, and it adds no build dependency to an example whose job is to be
  read.

The pattern to notice: **React writes numbers and states, CSS decides what they
mean.**

```tsx
<div
  className={styles.track}
  data-tone="health"
  data-state={state}
  style={cssVars({ "--pct": health / 100 })}
>
  <div className={styles.fill} />
</div>
```

Width, colour, threshold behaviour and the low-health pulse all live in
[stat-bar.module.css](src/components/stat-bar/stat-bar.module.css). A value
arriving at 10 Hz costs one style recalculation instead of a re-render that
rebuilds a class string. Team colour works the same way: a container sets
`data-team`, `tokens.css` resolves `--team` from it, and every descendant
inherits it — no component branches on which side it is drawing.

## Layout

```
.env          — local overrides; .env.example documents every variable
server/       manager.ts    — the GSI + handler config
              standalone.ts — the server itself; also serves dist/ for OBS
scripts/      mock-feed.ts  — synthetic match, no CS2 needed
src/lib/      events.ts     — the events the server is told to forward
              derive.ts     — roster projection + health thresholds
              format.ts     — clock, money and weapon-name rendering
              css.ts        — typed custom properties for `style`
src/components/<name>/<name>.tsx + <name>.module.css
```
