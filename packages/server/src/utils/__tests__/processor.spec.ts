import { describe, it, expect, beforeEach, vi } from "vitest";

import { MAX_PATH_DEPTH } from "@counter-strike-2-gsi/types";
import type { SchemaPayload, EventMap } from "@counter-strike-2-gsi/types";

import microdiff from "microdiff";

import { createEmitter } from "../../lib/emitter";
import { Processor } from "../processor";
import { payload, clonePayload } from "../../../tests/fixtures";

vi.mock("microdiff", async (importOriginal) => {
  const actual = await importOriginal<typeof import("microdiff")>();

  return { ...actual, default: vi.fn(actual.default) };
});

describe("@server/utils: processor", () => {
  let processor: Processor;
  let emitter: ReturnType<typeof createEmitter<EventMap>>;
  let previous: SchemaPayload;
  let current: SchemaPayload;

  beforeEach(() => {
    processor = new Processor();
    emitter = createEmitter<EventMap>();
    previous = clonePayload(payload);
    current = clonePayload(payload);

    vi.mocked(microdiff).mockClear();
  });

  describe("granular()", () => {
    it("emits nothing when states are deep-equal", () => {
      const spy = vi.spyOn(emitter, "emit");

      emitter.on("player:state:health", vi.fn());

      processor.granular(previous, current, emitter);

      expect(spy).not.toHaveBeenCalled();
    });

    it("diffs only blocks that have granular listeners", () => {
      current.player = {
        ...previous.player!,
        state: {
          ...previous.player!.state!,
          health: 67,
        },
      };
      current.map = {
        ...previous.map!,
        round: 9,
      };

      emitter.on("player:state:health", vi.fn());
      vi.mocked(microdiff).mockClear();

      processor.granular(previous, current, emitter);

      expect(microdiff).toHaveBeenCalledTimes(1);
      expect(vi.mocked(microdiff).mock.calls[0]![0]).toBe(previous.player);
    });

    it("skips diff work entirely when nothing is subscribed", () => {
      current.player = {
        ...previous.player!,
        state: {
          ...previous.player!.state!,
          health: 67,
        },
      };

      vi.mocked(microdiff).mockClear();

      processor.granular(previous, current, emitter);

      expect(microdiff).not.toHaveBeenCalled();
    });

    it("uses a deep-equal check instead of a diff for block-only listeners", () => {
      current.map = {
        ...previous.map!,
        round: 9,
      };

      const listener = vi.fn();

      emitter.on("map", listener);
      vi.mocked(microdiff).mockClear();

      processor.granular(previous, current, emitter);

      expect(microdiff).not.toHaveBeenCalled();
      expect(listener).toHaveBeenCalledOnce();
    });

    it("does not let allplayers:joined/left listeners trigger a deep diff of allplayers", () => {
      const newId = "76561198000000099";

      current.allplayers = {
        ...previous.allplayers,
        [newId]: {
          ...previous.allplayers!["76561198000000001"]!,
          steamid: newId,
          name: "NiKo",
        },
      } as SchemaPayload["allplayers"];

      const listener = vi.fn();

      emitter.on("allplayers:joined", listener);
      vi.mocked(microdiff).mockClear();

      processor.granular(previous, current, emitter);

      expect(microdiff).not.toHaveBeenCalled();
      expect(listener).toHaveBeenCalledOnce();
    });

    it("emits block-level event when a change occurs in that block", () => {
      current.player = {
        ...previous.player!,
        state: {
          ...previous.player!.state!,
          health: 67,
        },
      };

      const listener = vi.fn();

      emitter.on("player", listener);
      processor.granular(previous, current, emitter);

      expect(listener).toHaveBeenCalledOnce();
      expect(listener).toHaveBeenCalledWith({
        previous: previous.player,
        current: current.player,
      });
    });

    it("deduplicates block event — emits it only once for multiple changes in the same block", () => {
      current.player = {
        ...previous.player!,
        state: {
          ...previous.player!.state!,
          health: 67,
          armor: 82,
        },
      };

      const listener = vi.fn();

      emitter.on("player", listener);
      emitter.on("player:state:health", vi.fn());
      processor.granular(previous, current, emitter);

      expect(listener).toHaveBeenCalledOnce();
    });

    it("emits correct delta for CHANGE diff type", () => {
      current.player = {
        ...previous.player!,
        state: {
          ...previous.player!.state!,
          health: 67,
        },
      };

      const listener = vi.fn();

      emitter.on("player:state:health", listener);
      processor.granular(previous, current, emitter);

      expect(listener).toHaveBeenCalledWith({
        previous: 100,
        current: 67,
      });
    });

    it("emits correct delta for CREATE diff type", () => {
      previous.bomb = {
        position: "0, 0, 0",
        player: "76561198253772619",
      };
      current.bomb = {
        ...previous.bomb,
        state: "planted",
      };

      const listener = vi.fn();

      emitter.on("bomb:state", listener);
      processor.granular(previous, current, emitter);

      expect(listener).toHaveBeenCalledWith({
        previous: undefined,
        current: "planted",
      });
    });

    it("emits correct delta for REMOVE diff type", () => {
      const oldGrenade = previous.grenades!["291"];

      current.grenades = {
        "331": current.grenades!["331"]!,
      };

      const listener = vi.fn();

      //TODO:
      // update the type to handle these cases
      emitter.on("grenades:291" as keyof EventMap, listener);
      processor.granular(previous, current, emitter);

      expect(listener).toHaveBeenCalledWith({
        previous: oldGrenade,
        current: undefined,
      });
    });

    it("emits only the block event when a block appears wholesale", () => {
      const spy = vi.spyOn(emitter, "emit");

      current.bomb = {
        state: "planted",
        position: "0, 0, 0",
        player: "76561198253772619",
        countdown: "35.0",
      };

      emitter.on("bomb", vi.fn());
      emitter.on("bomb:state", vi.fn());
      processor.granular(previous, current, emitter);

      const emittedEvents = spy.mock.calls.map(([event]) => String(event));

      expect(emittedEvents).toContain("bomb");
      // No granular sub-path event ("bomb:state", "bomb:player", ...) — the
      // block appeared wholesale, so its CREATE is reported as one block
      // event, matching how a whole-tree microdiff reports a single CREATE
      // at the block root rather than per-field. "bomb:planted" is a
      // legitimate exception: it's a derived event (computed independently
      // of the granular diff, from `bomb.state`'s own before/after), not a
      // diff path, and it correctly fires on this exact transition.
      expect(emittedEvents).not.toContain("bomb:state");
      expect(emittedEvents).not.toContain("bomb:player");
      expect(emittedEvents).not.toContain("bomb:position");
      expect(emittedEvents).not.toContain("bomb:countdown");
      expect(emittedEvents).toContain("bomb:planted");
    });

    it("emits granular events using the full change path", () => {
      current.player = clonePayload(payload).player;
      current.player!.weapons!["weapon_0"]!.ammo_clip = 20;

      const intermediateListener = vi.fn();
      const deepListener = vi.fn();

      emitter.on("player:weapons:weapon_0" as keyof EventMap, intermediateListener);
      emitter.on("player:weapons:weapon_0:ammo_clip" as keyof EventMap, deepListener);
      processor.granular(previous, current, emitter);

      expect(intermediateListener).not.toHaveBeenCalled();
      expect(deepListener).toHaveBeenCalledOnce();
      expect(deepListener).toHaveBeenCalledWith({
        previous: 30,
        current: 20,
      });
    });

    it("emits a granular event for a path with exactly 2 segments", () => {
      current.player = {
        ...previous.player!,
        spectarget: "76561198000000002",
      };

      const listener = vi.fn();

      emitter.on("player:spectarget", listener);
      processor.granular(previous, current, emitter);

      expect(listener).toHaveBeenCalledOnce();
      expect(listener).toHaveBeenCalledWith({
        previous: undefined,
        current: "76561198000000002",
      });
    });

    it("treats all previous players as left when allplayers is absent from current", () => {
      const curr = {
        ...current,
      } as Partial<SchemaPayload>;

      delete curr.allplayers;

      const listener = vi.fn();

      emitter.on("allplayers:left", listener);
      processor.granular(previous, curr as SchemaPayload, emitter);

      expect(listener).toHaveBeenCalledOnce();
      expect(listener).toHaveBeenCalledWith({
        previous: undefined,
        current: expect.arrayContaining(Object.keys(previous.allplayers!)),
      });
    });

    it("always runs allplayers logic regardless of change content", () => {
      const newId = "76561198000000099";

      current.allplayers = {
        ...previous.allplayers,
        [newId]: {
          ...previous.allplayers!["76561198000000001"]!,
          steamid: newId,
          name: "new",
        },
      } as SchemaPayload["allplayers"];

      const listener = vi.fn();

      emitter.on("allplayers:joined", listener);
      processor.granular(previous, current, emitter);

      expect(listener).toHaveBeenCalledOnce();
      expect(listener).toHaveBeenCalledWith({ previous: undefined, current: [newId] });
    });
  });

  // Every name reaching `emit` has to be one `LeafPaths<SchemaPayload>`
  // generates, or the event is unsubscribable with types on: the compiler
  // says "allplayers:joined", the runtime says "allplayers:custom:joined".
  describe("granular() — event-name canonicalisation", () => {
    const emittedNames = (spy: { mock: { calls: unknown[][] } }): string[] =>
      spy.mock.calls.map((call) => String(call[0]));

    it("never emits a name containing a flattened key", () => {
      const spy = vi.spyOn(emitter, "emit");

      current.allplayers = {
        ...previous.allplayers,
        custom: {
          joined: ["76561198000000099"],
          left: [],
        },
      } as SchemaPayload["allplayers"];

      emitter.on("allplayers:76561198000000001:state:health" as keyof EventMap, vi.fn());
      processor.granular(previous, current, emitter);

      expect(emittedNames(spy).some((name) => name.includes(":custom"))).toBe(false);
    });

    it("does not flatten a 'custom' key found deeper than the block's direct child", () => {
      const spy = vi.spyOn(emitter, "emit");

      current.player = {
        ...current.player!,
        weapons: {
          ...current.player!.weapons,
          weapon_0: {
            ...current.player!.weapons!.weapon_0!,
            custom: "not-roster-bookkeeping",
          },
        },
      } as unknown as SchemaPayload["player"];

      emitter.on("player:weapons:weapon_0:name" as keyof EventMap, vi.fn());
      processor.granular(previous, current, emitter);

      // Unlike allplayers.custom — flattened because it's the block's direct
      // child, exactly where the schema declares it — a "custom" key nested
      // deeper is an ordinary path segment and must reach a name rather than
      // being silently dropped by the flatten meant for roster bookkeeping.
      expect(emittedNames(spy)).toContain("player:weapons:weapon_0:custom");
    });

    it("leaves allplayers:joined to derived() rather than emitting it twice", () => {
      const spy = vi.spyOn(emitter, "emit");
      const newId = "76561198000000099";

      current.allplayers = {
        ...previous.allplayers,
        [newId]: {
          ...previous.allplayers!["76561198000000001"]!,
          steamid: newId,
        },
        custom: {
          joined: [newId],
          left: [],
        },
      } as SchemaPayload["allplayers"];

      emitter.on("allplayers:76561198000000001:state:health" as keyof EventMap, vi.fn());
      emitter.on("allplayers:joined", vi.fn());
      processor.granular(previous, current, emitter);

      const joins = emittedNames(spy).filter((name) => name === "allplayers:joined");

      expect(joins).toHaveLength(1);
    });

    it("does not count the flattened 'custom' key as a player joining", () => {
      const listener = vi.fn();

      current.allplayers = {
        ...previous.allplayers,
        custom: {
          joined: [],
          left: ["76561198000000003"],
        },
      } as SchemaPayload["allplayers"];

      emitter.on("allplayers:joined", listener);
      processor.granular(previous, current, emitter);

      expect(listener).not.toHaveBeenCalled();
    });

    it("truncates at an array instead of emitting a numeric index segment", () => {
      const listener = vi.fn();

      // Nothing in the schema types an array below a block today, but
      // `validatePayload: false` and a future CS2 field both can produce one.
      previous.grenades!["291"]!.flames = ["682.0, 1321.0, -85.0"] as never;
      current.grenades!["291"]!.flames = ["700.0, 1340.0, -85.0"] as never;

      emitter.on("grenades:291:flames" as keyof EventMap, listener);
      processor.granular(previous, current, emitter);

      expect(listener).toHaveBeenCalledOnce();
      expect(listener).toHaveBeenCalledWith({
        previous: ["682.0, 1321.0, -85.0"],
        current: ["700.0, 1340.0, -85.0"],
      });
    });

    // `allplayers:<id>:weapons:<slot>:<field>` is already MAX_PATH_DEPTH
    // segments, so anything nested below a weapon overruns the cap.
    const withStickers = (state: SchemaPayload, steamid: string, stickers: object) => {
      const weapons = state.allplayers![steamid]!.weapons!;

      weapons["weapon_0"] = {
        ...weapons["weapon_0"]!,
        stickers,
      } as never;
    };

    it("truncates a path deeper than MAX_PATH_DEPTH to its deepest named ancestor", () => {
      const spy = vi.spyOn(emitter, "emit");
      const steamid = "76561198000000001";

      withStickers(previous, steamid, { slot_0: { name: "katowice" } });
      withStickers(current, steamid, { slot_0: { name: "boston" } });

      emitter.on(`allplayers:${steamid}:weapons:weapon_0:stickers` as keyof EventMap, vi.fn());
      processor.granular(previous, current, emitter);

      const granular = emittedNames(spy).filter((name) => name.startsWith("allplayers:"));

      // The raw diff path was `<id>:weapons:weapon_0:stickers:slot_0:name`.
      expect(granular).toEqual([`allplayers:${steamid}:weapons:weapon_0:stickers`]);
      expect(granular.every((name) => name.split(":").length <= MAX_PATH_DEPTH)).toBe(true);
    });

    it("collapses several over-deep changes onto one truncated event", () => {
      const listener = vi.fn();
      const steamid = "76561198000000001";

      withStickers(previous, steamid, {
        slot_0: { name: "katowice" },
        slot_1: { name: "cologne" },
      });
      withStickers(current, steamid, {
        slot_0: { name: "boston" },
        slot_1: { name: "berlin" },
      });

      emitter.on(`allplayers:${steamid}:weapons:weapon_0:stickers` as keyof EventMap, listener);
      processor.granular(previous, current, emitter);

      expect(listener).toHaveBeenCalledOnce();
      expect(listener.mock.calls[0]![0]).toEqual({
        previous: { slot_0: { name: "katowice" }, slot_1: { name: "cologne" } },
        current: { slot_0: { name: "boston" }, slot_1: { name: "berlin" } },
      });
    });

    it("still emits exact deltas for paths that need no truncation", () => {
      const listener = vi.fn();

      current.player!.state!.health = 67;

      emitter.on("player:state:health", listener);
      processor.granular(previous, current, emitter);

      expect(listener).toHaveBeenCalledWith({ previous: 100, current: 67 });
    });
  });

  describe("block()", () => {
    it("emits block event when block value changed", () => {
      current.player = {
        ...previous.player!,
        state: {
          ...previous.player!.state!,
          health: 67,
        },
      };

      const listener = vi.fn();

      emitter.on("player", listener);
      processor.block(previous, current, emitter);

      expect(listener).toHaveBeenCalledOnce();
      expect(listener).toHaveBeenCalledWith({
        previous: previous.player,
        current: current.player,
      });
    });

    it("correctly detects changes using fast-deep-equal despite new object references", () => {
      const listener = vi.fn();

      emitter.on("player", listener);
      processor.block(previous, current, emitter);

      expect(listener).not.toHaveBeenCalled();
    });

    it("emits block event for a block that only exists in previous (block removed)", () => {
      const prev = { ...previous };
      const curr = { ...current } as Partial<SchemaPayload>;

      delete curr.grenades;

      const listener = vi.fn();

      emitter.on("grenades", listener);
      processor.block(prev, curr as SchemaPayload, emitter);

      expect(listener).toHaveBeenCalledOnce();
      expect(listener).toHaveBeenCalledWith({
        previous: prev.grenades,
        current: undefined,
      });
    });

    it("emits block event for a block that only exists in current (block added)", () => {
      const prev = { ...previous } as Partial<SchemaPayload>;

      delete prev.bomb;

      current.bomb = {
        state: "planted",
        position: "0, 0, 0",
        player: "76561198253772619",
        countdown: "35.0",
      };

      const listener = vi.fn();

      emitter.on("bomb", listener);
      processor.block(prev as SchemaPayload, current, emitter);

      expect(listener).toHaveBeenCalledOnce();
      expect(listener).toHaveBeenCalledWith({
        previous: undefined,
        current: current.bomb,
      });
    });
  });

  describe("allplayers (via block())", () => {
    it("emits allplayers:joined with the new SteamID when a player appears in current", () => {
      const newId = "76561198000000099";

      current.allplayers = {
        ...previous.allplayers,
        [newId]: {
          ...previous.allplayers!["76561198000000001"]!,
          steamid: newId,
          name: "NiKo",
        },
      } as SchemaPayload["allplayers"];

      const listener = vi.fn();

      emitter.on("allplayers:joined", listener);
      processor.block(previous, current, emitter);

      expect(listener).toHaveBeenCalledWith({
        previous: undefined,
        current: [newId],
      });
    });

    it("emits allplayers:left with the removed SteamID when a player disappears from current", () => {
      const removedId = "76561198000000003";

      current.allplayers = {
        ...previous.allplayers,
      };

      delete current.allplayers![removedId];

      const listener = vi.fn();

      emitter.on("allplayers:left", listener);
      processor.block(previous, current, emitter);

      expect(listener).toHaveBeenCalledWith({
        previous: undefined,
        current: [removedId],
      });
    });

    it("emits both joined and left when one player joins and another leaves simultaneously", () => {
      const removedId = "76561198000000003";
      const newId = "76561198000000099";

      current.allplayers = {
        ...previous.allplayers,
      };

      delete current.allplayers![removedId];

      current.allplayers![newId] = {
        ...previous.allplayers!["76561198000000001"]!,
        steamid: newId,
        name: "device",
      };

      const joinedListener = vi.fn();
      const leftListener = vi.fn();

      emitter.on("allplayers:joined", joinedListener);
      emitter.on("allplayers:left", leftListener);
      processor.block(previous, current, emitter);

      expect(joinedListener).toHaveBeenCalledWith({
        previous: undefined,
        current: [newId],
      });
      expect(leftListener).toHaveBeenCalledWith({
        previous: undefined,
        current: [removedId],
      });
    });

    it("emits no allplayers events when SteamID keys are unchanged", () => {
      const spy = vi.spyOn(emitter, "emit");

      processor.block(previous, current, emitter);

      const emittedEvents = spy.mock.calls.map(([event]) => String(event));

      expect(emittedEvents).not.toContain("allplayers:joined");
      expect(emittedEvents).not.toContain("allplayers:left");
    });

    it("handles missing allplayers in previous gracefully (treats all current players as joined)", () => {
      const prev = { ...previous } as Partial<SchemaPayload>;

      delete prev.allplayers;

      const listener = vi.fn();

      emitter.on("allplayers:joined", listener);
      processor.block(prev as SchemaPayload, current, emitter);

      expect(listener).toHaveBeenCalledOnce();
      expect(listener).toHaveBeenCalledWith({
        previous: undefined,
        current: expect.arrayContaining(Object.keys(current.allplayers!)),
      });
    });
  });
});
