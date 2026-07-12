import { EventEmitter } from "node:events";

import { GSI, type GSIOptions } from "@counter-strike-2-gsi/server";
import type { EventMap } from "@counter-strike-2-gsi/types";
import { DifferManager, GsiUpdateHandler, default_differs } from "cs2-gsi-z";
import { CSGOGSI } from "csgogsi";
import { bench, describe } from "vitest";

import { serializedFrames, serializedHeartbeat } from "./session";

type HandlerOptions = ConstructorParameters<typeof GsiUpdateHandler>[0];
type HandlerInput = Parameters<GsiUpdateHandler["handle"]>[0];
type DigestInput = Parameters<CSGOGSI["digest"]>[0];

// Listener side effect so event dispatch can't be dead-code eliminated.
let sink = 0;
const count = () => {
  sink++;
};

function createGSI(changeDetection: GSIOptions["changeDetection"], validatePayload = true) {
  const gsi = new GSI({ changeDetection, validatePayload });

  gsi.on("update", count);
  gsi.on("player:state:health", count);
  gsi.on("round:phase", count);
  gsi.on("allplayers:joined", count);
  gsi.on("allplayers:left", count);

  return gsi;
}

// Granular diffing is subscription-aware, so the plain granular instance
// above (a typical HUD's handful of listeners) no longer deep-diffs every
// block. This variant subscribes under every block in the corpus to force
// worst-case full diffing, keeping the cross-library comparison honest.
function createGSIFullSubscription() {
  const gsi = createGSI("granular");
  const perBlockEvents = [
    "provider:timestamp",
    "map:round",
    "bomb:countdown",
    "grenades:291:lifetime",
    "allplayers:76561198000000001:state:health",
    "phase_countdowns:phase_ends_in",
  ] as Array<keyof EventMap>;

  for (const event of perBlockEvents) {
    gsi.on(event, count);
  }

  return gsi;
}

// Passing a real `Logger` makes GsiUpdateHandler JSON.stringify the full
// state twice per update (the verbose() argument is evaluated even when the
// level filters it out), and `logger: null` falls back to console.log on
// every update. A duck-typed no-op logger sidesteps both so the benchmark
// measures the diff engine, not logging.
const noopLogger = {
  child: (): unknown => noopLogger,
  log: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  verbose: () => undefined,
} as unknown as HandlerOptions["logger"];

function createCs2GsiZ() {
  const differManager = new DifferManager();

  // Differs fall back to raw `console` when no logger is given, so the
  // no-op logger must be passed here too or terminal I/O lands in the
  // measurement.
  for (const Differ of default_differs) {
    differManager.register(new Differ({ logger: noopLogger }));
  }

  const emitter = new EventEmitter() as HandlerOptions["emitter"];

  emitter.on("player:hpChanged", count);
  emitter.on("round:phaseChanged", count);
  emitter.on("allPlayers:joined", count);
  emitter.on("allPlayers:left", count);

  return new GsiUpdateHandler({ logger: noopLogger, differManager, emitter });
}

function createCsgogsi() {
  const gsi = new CSGOGSI();

  gsi.on("data", count);
  gsi.on("roundEnd", count);
  gsi.on("freezetimeStart", count);
  gsi.on("bombPlant", count);

  return gsi;
}

// Instances persist across iterations, so after the first cycle every
// iteration performs the same steady-state work: frame 0 (the full base
// snapshot) diffs against the end-of-round state, then the round replays.
describe(`session replay (${serializedFrames.length} frames: damage, buys, bomb, round end, roster churn)`, () => {
  const granular = createGSI("granular");
  const granularFullSub = createGSIFullSubscription();
  const block = createGSI("block");
  const minimal = createGSI("minimal");
  const granularNoValidate = createGSI("granular", false);
  const blockNoValidate = createGSI("block", false);
  const minimalNoValidate = createGSI("minimal", false);
  const cs2GsiZ = createCs2GsiZ();
  const csgogsi = createCsgogsi();

  bench("@counter-strike-2-gsi/server (granular)", () => {
    for (const frame of serializedFrames) {
      granular.update(JSON.parse(frame));
    }
  });

  bench("@counter-strike-2-gsi/server (granular, all blocks subscribed)", () => {
    for (const frame of serializedFrames) {
      granularFullSub.update(JSON.parse(frame));
    }
  });

  bench("@counter-strike-2-gsi/server (block)", () => {
    for (const frame of serializedFrames) {
      block.update(JSON.parse(frame));
    }
  });

  bench("@counter-strike-2-gsi/server (minimal)", () => {
    for (const frame of serializedFrames) {
      minimal.update(JSON.parse(frame));
    }
  });

  bench("@counter-strike-2-gsi/server (granular, no validation)", () => {
    for (const frame of serializedFrames) {
      granularNoValidate.update(JSON.parse(frame));
    }
  });

  bench("@counter-strike-2-gsi/server (block, no validation)", () => {
    for (const frame of serializedFrames) {
      blockNoValidate.update(JSON.parse(frame));
    }
  });

  bench("@counter-strike-2-gsi/server (minimal, no validation)", () => {
    for (const frame of serializedFrames) {
      minimalNoValidate.update(JSON.parse(frame));
    }
  });

  bench("cs2-gsi-z (default differs)", () => {
    for (const frame of serializedFrames) {
      cs2GsiZ.handle(JSON.parse(frame) as HandlerInput);
    }
  });

  bench("csgogsi (digest)", () => {
    for (const frame of serializedFrames) {
      csgogsi.digest(JSON.parse(frame) as DigestInput);
    }
  });
});

// The common case at 64Hz: a POST arrives but nothing relevant changed.
describe("no-change heartbeat", () => {
  const granular = createGSI("granular");
  const granularFullSub = createGSIFullSubscription();
  const block = createGSI("block");
  const minimal = createGSI("minimal");
  const granularNoValidate = createGSI("granular", false);
  const cs2GsiZ = createCs2GsiZ();
  const csgogsi = createCsgogsi();

  granular.update(JSON.parse(serializedHeartbeat));
  granularFullSub.update(JSON.parse(serializedHeartbeat));
  block.update(JSON.parse(serializedHeartbeat));
  minimal.update(JSON.parse(serializedHeartbeat));
  granularNoValidate.update(JSON.parse(serializedHeartbeat));
  cs2GsiZ.handle(JSON.parse(serializedHeartbeat) as HandlerInput);
  csgogsi.digest(JSON.parse(serializedHeartbeat) as DigestInput);

  bench("@counter-strike-2-gsi/server (granular)", () => {
    granular.update(JSON.parse(serializedHeartbeat));
  });

  bench("@counter-strike-2-gsi/server (granular, all blocks subscribed)", () => {
    granularFullSub.update(JSON.parse(serializedHeartbeat));
  });

  bench("@counter-strike-2-gsi/server (block)", () => {
    block.update(JSON.parse(serializedHeartbeat));
  });

  bench("@counter-strike-2-gsi/server (minimal)", () => {
    minimal.update(JSON.parse(serializedHeartbeat));
  });

  bench("@counter-strike-2-gsi/server (granular, no validation)", () => {
    granularNoValidate.update(JSON.parse(serializedHeartbeat));
  });

  bench("cs2-gsi-z (default differs)", () => {
    cs2GsiZ.handle(JSON.parse(serializedHeartbeat) as HandlerInput);
  });

  bench("csgogsi (digest)", () => {
    csgogsi.digest(JSON.parse(serializedHeartbeat) as DigestInput);
  });
});

// Read the sink after benches are registered so bundlers keep the listeners.
export { sink };
