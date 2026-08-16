import { describe, it, expect, vi } from "vitest";

import { schema, MAX_PATH_DEPTH, FLATTENED_KEYS } from "@counter-strike-2-gsi/types";
import type { EventMap, SchemaPayload } from "@counter-strike-2-gsi/types";

import { createEmitter } from "../../lib/emitter";
import { Processor } from "../processor";
import { parsePayload } from "../parser";
import { mergeDelta } from "../merge";
import { payload, clonePayload } from "../../../tests/fixtures";

/**
 * Runtime mirror of the `LeafPaths` traversal, evaluated against arktype's
 * `json` form of the schema: declared keys cost one segment, flattened keys
 * are walked through for free, index signatures match any segment, and
 * arrays are opaque leaves. An event name emitted by the processor is
 * round-trip consistent exactly when its segments resolve here — the same
 * grammar the type system uses to generate `GeneratedEventMap` keys.
 */

interface JsonEntry {
  key?: string;
  value?: unknown;
}

interface JsonNode {
  required?: JsonEntry[];
  optional?: JsonEntry[];
  index?: Array<{ value?: unknown }>;
  proto?: string;
}

const FLATTENED = new Set<string>(FLATTENED_KEYS);

function resolvesInSchema(node: unknown, segments: string[]): boolean {
  if (segments.length === 0) {
    return true;
  }

  if (Array.isArray(node)) {
    return node.some((branch) => resolvesInSchema(branch, segments));
  }

  if (typeof node !== "object" || node === null) {
    return false;
  }

  const { required = [], optional = [], index = [], proto } = node as JsonNode;

  if (proto === "Array") {
    return false;
  }

  const [head, ...rest] = segments;

  for (const entry of [...required, ...optional]) {
    if (entry.key === undefined) {
      continue;
    }

    if (FLATTENED.has(entry.key)) {
      if (resolvesInSchema(entry.value, segments)) {
        return true;
      }

      continue;
    }

    if (entry.key === head && resolvesInSchema(entry.value, rest)) {
      return true;
    }
  }

  for (const entry of index) {
    if (resolvesInSchema(entry.value, rest)) {
      return true;
    }
  }

  return false;
}

const isValidEventName = (name: string): boolean => {
  const segments = name.split(":");

  return segments.length <= MAX_PATH_DEPTH && resolvesInSchema(schema.payload.json, segments);
};

/**
 * Hand-declared `EventMap` entries the processor emits that are not diff
 * paths, so the schema grammar is not expected to resolve them.
 */
const CUSTOM_EVENTS = new Set([
  "update",
  "error",
  "validation",
  "allplayers:joined",
  "allplayers:left",
  "round:started",
  "round:ended",
  "bomb:planted",
  "bomb:defused",
  "bomb:exploded",
  "player:died",
  "player:killed",
]);

describe("@server/utils: microdiff path ↔ LeafPaths round-trip", () => {
  describe("the schema grammar itself", () => {
    it("accepts the event families the type system generates", () => {
      expect(isValidEventName("player")).toBe(true);
      expect(isValidEventName("player:state:health")).toBe(true);
      expect(isValidEventName("player:weapons:weapon_0:name")).toBe(true);
      expect(isValidEventName("allplayers:76561198000000001:state:health")).toBe(true);
      expect(isValidEventName("allplayers:76561198000000001:weapons:weapon_0:name")).toBe(true);
      expect(isValidEventName("grenades:291:flames:flame_p682_p1321_n85")).toBe(true);
      expect(isValidEventName("map:team_ct:score")).toBe(true);
    });

    it("resolves the flattened custom subtree on the server's computed names", () => {
      expect(isValidEventName("allplayers:joined")).toBe(true);
      expect(isValidEventName("allplayers:left")).toBe(true);
    });

    it("rejects the unflattened custom paths and their array indices", () => {
      // "allplayers:custom" alone is indistinguishable from a SteamID key by
      // the index signature (it matches `allplayers:${string}`, just as it
      // would at the type level) — the parser's strip is what keeps it out of
      // runtime events. The deeper unflattened paths don't resolve at all:
      expect(isValidEventName("allplayers:custom:joined")).toBe(false);
      expect(isValidEventName("allplayers:custom:joined:0")).toBe(false);
      // Through the flatten the arrays are still leaves: no index paths.
      expect(isValidEventName("allplayers:joined:0")).toBe(false);
    });

    it("rejects names outside the schema", () => {
      expect(isValidEventName("player:bogus")).toBe(false);
      expect(isValidEventName("nonexistent")).toBe(false);
      expect(isValidEventName("player:state:health:extra")).toBe(false);
    });
  });

  describe("processor emissions", () => {
    /**
     * Registering `<block>:<anything>` marks the block as granular-interested,
     * so the processor deep-diffs it and emits every changed path under it.
     */
    function emittedEventNames(
      previous: Parameters<Processor["granular"]>[0],
      current: Parameters<Processor["granular"]>[1],
    ): string[] {
      const emitter = createEmitter<EventMap>();
      const spy = vi.spyOn(emitter, "emit");

      for (const block of new Set([...Object.keys(previous), ...Object.keys(current)])) {
        emitter.on(`${block}:__probe__` as keyof EventMap, vi.fn());
      }

      new Processor().granular(previous, current, emitter);

      return spy.mock.calls.map(([name]) => String(name));
    }

    it("every granular event name from a realistic multi-block transition resolves in the schema grammar", () => {
      // Sanitized baseline, exactly what GSI.update() would hold as state.
      const previous = parsePayload(clonePayload(payload));

      // One delta touching every event family at once: scalar changes, a
      // sparse-collection removal (weapon drop), a roster change, a nested
      // sub-object (flames), and a whole-block change.
      const current = mergeDelta(previous, {
        player: {
          state: { ...previous.player!.state!, health: 41 },
          weapons: {
            weapon_0: { ...previous.player!.weapons!.weapon_0!, ammo_clip: 3 },
          },
        },
        map: { round: 9, team_ct: { ...previous.map!.team_ct!, score: 6 } },
        round: { phase: "over", win_team: "CT" },
        bomb: { state: "planted", countdown: "35.0" },
        grenades: {
          "291": {
            ...previous.grenades!["291"]!,
            lifetime: "5.5",
            flames: { flame_p700_p1340_n85: "700.0, 1340.0, -85.0" },
          },
        },
        allplayers: {
          "76561198000000001": {
            ...previous.allplayers!["76561198000000001"]!,
            state: { ...previous.allplayers!["76561198000000001"]!.state!, health: 12 },
            weapons: {
              weapon_0: previous.allplayers!["76561198000000001"]!.weapons!.weapon_0!,
            },
          },
          "76561198000000002": previous.allplayers!["76561198000000002"]!,
          // "...003" left the match; a new player joins.
          "76561198000000099": {
            ...previous.allplayers!["76561198000000002"]!,
            steamid: "76561198000000099",
            name: "NiKo",
          },
        },
      } as unknown as Partial<SchemaPayload>);

      const names = emittedEventNames(previous, current);
      const granular = names.filter((name) => !CUSTOM_EVENTS.has(name));

      // The transition must actually exercise deep paths, or this test
      // proves nothing.
      expect(granular.length).toBeGreaterThan(10);
      expect(granular).toContain("player:state:health");
      expect(granular).toContain("allplayers:76561198000000001:weapons:weapon_1");

      for (const name of granular) {
        expect(
          isValidEventName(name),
          `emitted "${name}" does not resolve in the schema grammar`,
        ).toBe(true);
      }
    });

    it("emits no custom-subtree or numeric-index names even when CS2 sends allplayers.custom", () => {
      const previous = parsePayload(clonePayload(payload));

      // The raw payload CS2 would POST on a roster change: the new player in
      // the roster plus its own `custom` bookkeeping describing the join.
      const raw = clonePayload(payload);

      raw.allplayers = {
        ...raw.allplayers,
        "76561198000000099": {
          ...raw.allplayers!["76561198000000002"]!,
          steamid: "76561198000000099",
          name: "NiKo",
        },
        custom: { joined: ["76561198000000099"], left: [] },
      } as typeof raw.allplayers;

      const current = parsePayload(raw);

      const names = emittedEventNames(previous, current);

      // The roster change comes through as the computed event plus the
      // schema-valid CREATE path — one concept, one name family.
      expect(names).toContain("allplayers:joined");
      expect(names).toContain("allplayers:76561198000000099");
      expect(names.every((name) => !name.includes("custom"))).toBe(true);

      // And every diff-derived name still resolves in the grammar, which is
      // what rules out array-index paths like "allplayers:custom:joined:0"
      // while steamid segments (numeric, but index-signature keys) pass.
      for (const name of names.filter((n) => !CUSTOM_EVENTS.has(n))) {
        expect(
          isValidEventName(name),
          `emitted "${name}" does not resolve in the schema grammar`,
        ).toBe(true);
      }
    });
  });
});
