import { describe, it, expect, beforeEach, vi } from "vitest";

import type { SchemaPayload, EventMap } from "@counter-strike-2-gsi/types";
import type { Difference } from "microdiff";

import { createEmitter } from "../../lib/emitter";
import { Processor } from "../processor";
import { payload, clonePayload } from "../../../tests/fixtures";

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
  });

  // ─── granular() ────────────────────────────────────────────────────────────

  describe("granular()", () => {
    it("does nothing when changes array is empty", () => {
      const spy = vi.spyOn(emitter, "emit");

      processor.granular(previous, current, [], emitter);

      expect(spy).not.toHaveBeenCalled();
    });

    it("skips changes with empty path", () => {
      const spy = vi.spyOn(emitter, "emit");
      const changes: Difference[] = [
        {
          type: "CHANGE",
          path: [],
          value: "x",
          oldValue: "y",
        },
      ];

      processor.granular(previous, current, changes, emitter);

      expect(spy).not.toHaveBeenCalled();
    });

    it("emits block-level event when a change occurs in that block", () => {
      current.player = {
        ...previous.player!,
        state: {
          ...previous.player!.state!,
          health: 67,
        },
      };

      const changes: Difference[] = [
        {
          type: "CHANGE",
          path: ["player", "state", "health"],
          value: 67,
          oldValue: 100,
        },
      ];

      const listener = vi.fn();

      emitter.on("player", listener);
      processor.granular(previous, current, changes, emitter);

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

      const changes: Difference[] = [
        {
          type: "CHANGE",
          path: ["player", "state", "health"],
          value: 67,
          oldValue: 100,
        },
        {
          type: "CHANGE",
          path: ["player", "state", "armor"],
          value: 82,
          oldValue: 100,
        },
      ];

      const listener = vi.fn();

      emitter.on("player", listener);
      processor.granular(previous, current, changes, emitter);

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

      const changes: Difference[] = [
        {
          type: "CHANGE",
          path: ["player", "state", "health"],
          value: 67,
          oldValue: 100,
        },
      ];

      const listener = vi.fn();

      emitter.on("player:state:health", listener);
      processor.granular(previous, current, changes, emitter);

      expect(listener).toHaveBeenCalledWith({
        previous: 100,
        current: 67,
      });
    });

    it("emits correct delta for CREATE diff type", () => {
      const changes: Difference[] = [
        {
          type: "CREATE",
          path: ["bomb", "state"],
          value: "planted",
        },
      ];

      const listener = vi.fn();

      emitter.on("bomb:state", listener);
      processor.granular(previous, current, changes, emitter);

      expect(listener).toHaveBeenCalledWith({
        previous: undefined,
        current: "planted",
      });
    });

    it("emits correct delta for REMOVE diff type", () => {
      const oldGrenade = previous.grenades!["291"];
      const changes: Difference[] = [
        {
          type: "REMOVE",
          path: ["grenades", "291"],
          oldValue: oldGrenade,
        },
      ];

      const listener = vi.fn();

      //TODO:
      // update the type to handle these cases
      emitter.on("grenades:291" as keyof EventMap, listener);
      processor.granular(previous, current, changes, emitter);

      expect(listener).toHaveBeenCalledWith({
        previous: oldGrenade,
        current: undefined,
      });
    });

    it("does not emit a granular event when path has only 1 segment", () => {
      const spy = vi.spyOn(emitter, "emit");

      const changes: Difference[] = [
        {
          type: "CHANGE",
          path: ["player"],
          value: current.player,
          oldValue: previous.player,
        },
      ];

      processor.granular(previous, current, changes, emitter);

      const emittedEvents = spy.mock.calls.map(([event]) => String(event));

      expect(emittedEvents).toContain("player");
      expect(emittedEvents.some((e) => e.startsWith("player:"))).toBe(false);
    });

    it("emits granular events using the full change path", () => {
      const changes: Difference[] = [
        {
          type: "CHANGE",
          path: ["player", "weapons", "weapon_0", "ammo_clip"],
          value: 20,
          oldValue: 30,
        },
      ];

      const intermediateListener = vi.fn();
      const deepListener = vi.fn();

      emitter.on("player:weapons:weapon_0" as keyof EventMap, intermediateListener);
      emitter.on("player:weapons:weapon_0:ammo_clip" as keyof EventMap, deepListener);
      processor.granular(previous, current, changes, emitter);

      expect(intermediateListener).not.toHaveBeenCalled();
      expect(deepListener).toHaveBeenCalledOnce();
    });

    it("emits a granular event for a path with exactly 2 segments", () => {
      current.player = {
        ...previous.player!,
        state: {
          ...previous.player!.state!,
          health: 67,
          armor: 82,
        },
      };
      const changes: Difference[] = [
        {
          type: "CHANGE",
          path: ["player", "state"],
          value: current.player.state,
          oldValue: previous.player!.state,
        },
      ];

      const listener = vi.fn();

      emitter.on("player:state", listener);
      processor.granular(previous, current, changes, emitter);

      expect(listener).toHaveBeenCalledOnce();
      expect(listener).toHaveBeenCalledWith({
        previous: previous.player!.state,
        current: current.player.state,
      });
    });

    it("treats all previous players as left when allplayers is absent from current", () => {
      const curr = {
        ...current,
      } as Partial<SchemaPayload>;

      delete curr.allplayers;

      const changes: Difference[] = [
        {
          type: "CHANGE",
          path: ["player", "state", "health"],
          value: 67,
          oldValue: 100,
        },
      ];

      const listener = vi.fn();

      emitter.on("allplayers:left", listener);
      processor.granular(previous, curr as SchemaPayload, changes, emitter);

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

      const changes: Difference[] = [
        {
          type: "CHANGE",
          path: ["player", "state", "health"],
          value: 67,
          oldValue: 100,
        },
      ];

      const listener = vi.fn();

      emitter.on("allplayers:joined", listener);
      processor.granular(previous, current, changes, emitter);

      expect(listener).toHaveBeenCalledOnce();
      expect(listener).toHaveBeenCalledWith({ previous: undefined, current: [newId] });
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
