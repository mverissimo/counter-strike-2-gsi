import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { GSI } from "../gsi";
import { payload, clonePayload } from "../../tests/fixtures";

// Helpers — always produce fully-valid payloads so ArkType never warns.

function withPlayerHealth(hp: number) {
  const p = clonePayload(payload);

  p.player = {
    ...p.player!,
    state: {
      ...p.player!.state!,
      health: hp,
    },
  };

  return p;
}

function withPlayerKills(roundKills: number, roundKillhs: number) {
  const p = clonePayload(payload);

  p.player = {
    ...p.player!,
    state: {
      ...p.player!.state!,
      round_kills: roundKills,
      round_killhs: roundKillhs,
    },
  };

  return p;
}

function withExtraPlayer(steamid = "76561198000000099") {
  const p = clonePayload(payload);

  p.allplayers = {
    ...p.allplayers,
    [steamid]: { ...p.allplayers!["76561198000000001"]!, steamid, name: "NiKo" },
  };

  return p;
}

function withoutPlayer(steamid: string) {
  const data = clonePayload(payload);

  delete data.allplayers![steamid];

  return data;
}

describe("@server: GSI", () => {
  describe("constructor", () => {
    it("initialises with empty state and zero stats", () => {
      const manager = new GSI();

      expect(manager.state).toEqual({});
    });
  });

  describe("modes", () => {
    describe("update(on any event)", () => {
      it("always emits 'update' with the current state", () => {
        const manager = new GSI();
        const listener = vi.fn();

        manager.on("update", listener);
        manager.update(payload);

        expect(listener).toHaveBeenCalledOnce();
        expect(listener).toHaveBeenCalledWith(manager.state);
      });

      it("emits 'update' even when the payload produces no diff (no-op)", () => {
        const manager = new GSI();

        manager.update(payload);

        const listener = vi.fn();

        manager.on("update", listener);
        manager.update(payload);

        expect(listener).toHaveBeenCalledOnce();
      });

      it("handles the first update correctly when previous state is empty", () => {
        const manager = new GSI();
        const listener = vi.fn();

        manager.on("player", listener);
        manager.update(payload);

        expect(listener).toHaveBeenCalledOnce();
        expect(listener).toHaveBeenCalledWith({
          previous: undefined,
          current: expect.objectContaining({
            name: "s1mple",
          }),
        });
      });
    });

    describe("granular", () => {
      it("emits a block event when a top-level block changes", () => {
        const manager = new GSI();

        manager.update(payload);

        const listener = vi.fn();

        manager.on("player", listener);
        manager.update(withPlayerHealth(67));

        expect(listener).toHaveBeenCalledOnce();
        expect(listener).toHaveBeenCalledWith(
          expect.objectContaining({
            current: expect.objectContaining({ state: expect.objectContaining({ health: 67 }) }),
          }),
        );
      });

      it("emits a granular event with the correct delta for a nested field change", () => {
        const manager = new GSI();

        manager.update(payload);

        const listener = vi.fn();

        manager.on("player:state:health", listener);
        manager.update(withPlayerHealth(67));

        expect(listener).toHaveBeenCalledWith({
          previous: 100,
          current: 67,
        });
      });

      it("does not emit block or granular events when nothing actually changed", () => {
        const manager = new GSI();

        manager.update(payload);

        const blockSpy = vi.fn();
        const granularSpy = vi.fn();

        manager.on("player", blockSpy);
        manager.on("player:state:health", granularSpy);

        manager.update(payload);

        expect(blockSpy).not.toHaveBeenCalled();
        expect(granularSpy).not.toHaveBeenCalled();
      });

      it("emits allplayers:joined when a new SteamID appears", () => {
        const manager = new GSI();
        manager.update(payload);

        const listener = vi.fn();

        manager.on("allplayers:joined", listener);
        manager.update(withExtraPlayer("76561198000000099"));

        expect(listener).toHaveBeenCalledWith({
          previous: undefined,
          current: ["76561198000000099"],
        });
      });

      it("emits allplayers:left when a SteamID disappears", () => {
        const manager = new GSI();
        manager.update(payload);

        const listener = vi.fn();

        manager.on("allplayers:left", listener);
        manager.update(withoutPlayer("76561198000000003"));

        expect(listener).toHaveBeenCalledWith({
          previous: undefined,
          current: ["76561198000000003"],
        });
      });

      it("delivers granular events to listeners registered between updates", () => {
        const manager = new GSI();

        manager.update(payload);
        manager.update(withPlayerHealth(67));

        // Subscribing after previous updates must take effect on the next one.
        const listener = vi.fn();

        manager.on("player:state:health", listener);
        manager.update(withPlayerHealth(30));

        expect(listener).toHaveBeenCalledWith({ previous: 67, current: 30 });
      });

      it("emits granular events for every subscribed block that changed in one update", () => {
        const manager = new GSI();

        manager.update(payload);

        const healthSpy = vi.fn();
        const phaseSpy = vi.fn();

        manager.on("player:state:health", healthSpy);
        manager.on("round:phase", phaseSpy);

        const p = withPlayerHealth(50);

        p.round = { phase: "over" };

        manager.update(p);

        expect(healthSpy).toHaveBeenCalledWith({ previous: 100, current: 50 });
        expect(phaseSpy).toHaveBeenCalledWith({ previous: "live", current: "over" });
      });

      it("emits block deltas to a block-only listener when no granular listeners exist", () => {
        const manager = new GSI();

        manager.update(payload);

        const listener = vi.fn();

        manager.on("map", listener);

        const p = clonePayload(payload);

        p.map = { ...p.map!, round: 9 };

        manager.update(p);

        expect(listener).toHaveBeenCalledOnce();
        expect(listener).toHaveBeenCalledWith({
          previous: expect.objectContaining({ round: 8 }),
          current: expect.objectContaining({ round: 9 }),
        });
      });

      it("does not emit a block event when the block content is unchanged", () => {
        const manager = new GSI();

        manager.update(payload);

        const mapSpy = vi.fn();

        manager.on("map", mapSpy);
        manager.update(withPlayerHealth(67));

        expect(mapSpy).not.toHaveBeenCalled();
      });

      it("does not emit allplayers:joined/left when only player properties change", () => {
        const manager = new GSI();

        manager.update(payload);

        const joinedSpy = vi.fn();
        const leftSpy = vi.fn();

        manager.on("allplayers:joined", joinedSpy);
        manager.on("allplayers:left", leftSpy);

        manager.update(withPlayerHealth(67));

        expect(joinedSpy).not.toHaveBeenCalled();
        expect(leftSpy).not.toHaveBeenCalled();
      });
    });

    describe("block", () => {
      it("emits a block event when a block changes", () => {
        const manager = new GSI({ changeDetection: "block" });

        manager.update(payload);

        const listener = vi.fn();

        manager.on("player", listener);
        manager.update(withPlayerHealth(67));

        expect(listener).toHaveBeenCalledOnce();
      });

      it("does not emit granular events", () => {
        const manager = new GSI({
          changeDetection: "block",
        });

        manager.update(payload);

        const granularSpy = vi.fn();

        manager.on("player:state:health", granularSpy);
        manager.update(withPlayerHealth(67));

        expect(granularSpy).not.toHaveBeenCalled();
      });

      it("emits allplayers:joined when a new SteamID appears", () => {
        const manager = new GSI({
          changeDetection: "block",
        });

        manager.update(payload);

        const listener = vi.fn();

        manager.on("allplayers:joined", listener);
        manager.update(withExtraPlayer());

        expect(listener).toHaveBeenCalledOnce();
      });
    });

    describe("minimal", () => {
      it("emits 'update' and nothing else when the state changes", () => {
        const manager = new GSI({
          changeDetection: "minimal",
        });

        manager.update(payload);

        const blockSpy = vi.fn();
        const updateSpy = vi.fn();

        manager.on("player", blockSpy);
        manager.on("update", updateSpy);
        manager.update(withPlayerHealth(67));

        expect(blockSpy).not.toHaveBeenCalled();
        expect(updateSpy).toHaveBeenCalledOnce();
      });

      it("skips granular events but still emits allplayers:joined when players join", () => {
        const manager = new GSI({
          changeDetection: "minimal",
        });

        manager.update(payload);

        const granularSpy = vi.fn();
        const joinedSpy = vi.fn();

        manager.on("player:state:health", granularSpy);
        manager.on("allplayers:joined", joinedSpy);
        manager.update(withExtraPlayer());

        expect(granularSpy).not.toHaveBeenCalled();
        expect(joinedSpy).toHaveBeenCalledOnce();
      });
    });
  });

  describe("emitters on / off", () => {
    it("on returns an unsubscribe function that removes the listener", () => {
      const manager = new GSI();
      const listener = vi.fn();
      const unsub = manager.on("update", listener);

      unsub();

      manager.update(payload);

      expect(listener).not.toHaveBeenCalled();
    });

    it("off removes a specific handler while leaving others intact", () => {
      const manager = new GSI();

      const listenerA = vi.fn();
      const listenerB = vi.fn();

      manager.on("update", listenerA);
      manager.on("update", listenerB);
      manager.off("update", listenerA);
      manager.update(payload);

      expect(listenerA).not.toHaveBeenCalled();
      expect(listenerB).toHaveBeenCalledOnce();
    });
  });

  describe("error handling", () => {
    beforeEach(() => {
      vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("emits 'error' with the correct shape when given malformed JSON", () => {
      const manager = new GSI();
      const listener = vi.fn();

      manager.on("error", listener);
      manager.update("{broken json}");

      expect(listener).toHaveBeenCalledOnce();
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(Error),
          context: "update",
        }),
      );
    });

    it("state remains unchanged after a failed update", () => {
      const manager = new GSI();

      manager.update(payload);
      manager.on("error", () => {});
      manager.update("{broken json}");

      expect(manager.state.player?.name).toBe("s1mple");
    });

    it("recovers and processes valid updates after a failed one", () => {
      const manager = new GSI();

      manager.on("error", () => {});
      manager.update("{broken json}");
      manager.update(payload);

      expect(manager.state.player?.name).toBe("s1mple");
    });

    it("emits 'error' and rethrows in strict mode when the payload fails schema validation", () => {
      const manager = new GSI({
        strictValidation: true,
      });
      const listener = vi.fn();

      manager.on("error", listener);

      // Rethrows so transport handlers can turn the failure into a 4xx.
      expect(() =>
        manager.update({
          player: {
            state: {
              health: 999,
            },
          },
        }),
      ).toThrow("GSI validation failed");

      expect(listener).toHaveBeenCalledOnce();
      expect(listener.mock.calls[0][0].error.message).toContain("GSI validation failed");
    });
  });

  describe("validatePayload: false", () => {
    beforeEach(() => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("applies schema-invalid payloads as-is without warning or error", () => {
      const manager = new GSI({ validatePayload: false });
      const errorSpy = vi.fn();

      manager.on("error", errorSpy);
      manager.update({ player: { state: { health: 999 } } });

      expect(manager.state.player?.state?.health).toBe(999);
      expect(console.warn).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it("never throws in strict mode since validation is skipped", () => {
      const manager = new GSI({ strictValidation: true, validatePayload: false });

      expect(() => manager.update({ player: { state: { health: 999 } } })).not.toThrow();
    });

    it("still strips auth, previously, and added from the payload", () => {
      const manager = new GSI({ validatePayload: false });

      manager.update({
        ...clonePayload(payload),
        auth: { token: "secret" },
        previously: { player: { state: { health: 100 } } },
        added: { bomb: true },
      });

      expect(manager.state).not.toHaveProperty("auth");
      expect(manager.state).not.toHaveProperty("previously");
      expect(manager.state).not.toHaveProperty("added");
      expect(manager.state.player?.name).toBe("s1mple");
    });

    it("still rejects malformed JSON strings", () => {
      const manager = new GSI({ validatePayload: false });
      const errorSpy = vi.fn();

      manager.on("error", errorSpy);
      manager.update("{broken json}");

      expect(errorSpy).toHaveBeenCalledOnce();
    });
  });

  describe("state", () => {
    it("state reflects the payload after update", () => {
      const manager = new GSI();

      manager.update(payload);

      expect(manager.state.player?.name).toBe("s1mple");
      expect(manager.state.map?.name).toBe("de_inferno");
    });
  });

  describe("reset", () => {
    it("clears the state to an empty object", () => {
      const manager = new GSI();

      manager.update(payload);
      manager.reset();

      expect(manager.state).toEqual({});
    });

    it("always emits 'update' with an empty payload", () => {
      const manager = new GSI();

      manager.update(payload);

      const listener = vi.fn();

      manager.on("update", listener);
      manager.reset();

      expect(listener).toHaveBeenCalledOnce();
      expect(listener).toHaveBeenCalledWith({});
    });

    it("granular mode: emits block events for each removed block with previous/undefined delta", () => {
      const manager = new GSI({
        changeDetection: "granular",
      });

      manager.update(payload);

      const playerSpy = vi.fn();
      const mapSpy = vi.fn();

      manager.on("player", playerSpy);
      manager.on("map", mapSpy);
      manager.reset();

      expect(playerSpy).toHaveBeenCalledOnce();
      expect(playerSpy).toHaveBeenCalledWith({ previous: expect.any(Object), current: undefined });
      expect(mapSpy).toHaveBeenCalledOnce();
    });

    it("block mode: emits block events for each removed block", () => {
      const manager = new GSI({
        changeDetection: "block",
      });

      manager.update(payload);

      const playerSpy = vi.fn();

      manager.on("player", playerSpy);
      manager.reset();

      expect(playerSpy).toHaveBeenCalledOnce();
      expect(playerSpy).toHaveBeenCalledWith({
        previous: expect.any(Object),
        current: undefined,
      });
    });

    it("minimal mode: emits only 'update' — no block events", () => {
      const manager = new GSI({
        changeDetection: "minimal",
      });

      manager.update(payload);

      const blockSpy = vi.fn();

      manager.on("player", blockSpy);
      manager.reset();

      expect(blockSpy).not.toHaveBeenCalled();
    });

    it("reset on an already-empty state still emits 'update' with {}", () => {
      const manager = new GSI();
      const listener = vi.fn();

      manager.on("update", listener);
      manager.reset();

      expect(listener).toHaveBeenCalledWith({});
    });
  });

  describe("listener introspection", () => {
    it("eventNames() lists only events with a live listener", () => {
      const manager = new GSI();

      expect(manager.eventNames()).toEqual([]);

      manager.on("player:state:health", vi.fn());
      manager.on("round", vi.fn());

      expect(manager.eventNames().sort()).toEqual(["player:state:health", "round"]);
    });

    it("eventNames() drops an event once its last listener goes", () => {
      const manager = new GSI();
      const handler = vi.fn();

      const unsub = manager.on("player:state:health", handler);

      unsub();

      expect(manager.eventNames()).not.toContain("player:state:health");
    });

    it("listenerCount() counts registrations per event", () => {
      const manager = new GSI();

      expect(manager.listenerCount("update")).toBe(0);

      manager.on("update", vi.fn());
      manager.on("update", vi.fn());
      manager.on("player", vi.fn());

      expect(manager.listenerCount("update")).toBe(2);
      expect(manager.listenerCount("player")).toBe(1);
      expect(manager.listenerCount("error")).toBe(0);
    });

    it("listenerCount() drops back as listeners unsubscribe", () => {
      const manager = new GSI();
      const first = vi.fn();
      const second = vi.fn();

      manager.on("update", first);
      manager.on("update", second);
      manager.off("update", first);

      expect(manager.listenerCount("update")).toBe(1);

      manager.off("update");

      expect(manager.listenerCount("update")).toBe(0);
    });
  });

  describe("non-strict validation", () => {
    beforeEach(() => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("applies the blocks that validated and skips the ones that did not", () => {
      const manager = new GSI();

      manager.update({
        round: { phase: "live" },
        player: { state: { health: 999 } },
      });

      expect(manager.state.round).toEqual({ phase: "live" });
      expect(manager.state.player).toBeUndefined();
    });

    it("leaves previously-valid state untouched when a later block is invalid", () => {
      const manager = new GSI();

      manager.update(payload);

      const health = manager.state.player?.state?.health;

      manager.update({ player: { state: { health: 999 } } });

      expect(manager.state.player?.state?.health).toBe(health);
    });

    it("emits 'validation' with the dropped blocks when a payload is salvaged", () => {
      const manager = new GSI();
      const listener = vi.fn();

      manager.on("validation", listener);
      manager.update({
        round: { phase: "live" },
        player: { state: { health: 999 } },
      });

      expect(listener).toHaveBeenCalledOnce();
      expect(listener).toHaveBeenCalledWith({
        summary: expect.any(String),
        dropped: ["player"],
        discarded: false,
      });
      expect(manager.state.round).toEqual({ phase: "live" });
    });

    it("does not emit 'validation' for fully valid payloads", () => {
      const manager = new GSI();
      const listener = vi.fn();

      manager.on("validation", listener);
      manager.update(payload);

      expect(listener).not.toHaveBeenCalled();
    });

    it("does not emit 'validation' in strict mode (throws and emits 'error' instead)", () => {
      const manager = new GSI({ strictValidation: true });
      const listener = vi.fn();

      manager.on("validation", listener);
      manager.on("error", () => {});

      expect(() => manager.update({ player: { state: { health: 999 } } })).toThrow();
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("logger injection", () => {
    beforeEach(() => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("routes validation warnings to the injected logger instead of console", () => {
      const logger = { warn: vi.fn(), error: vi.fn() };
      const manager = new GSI({ logger });

      manager.update({ player: { state: { health: 999 } } });

      expect(logger.warn).toHaveBeenCalledOnce();
      expect(console.warn).not.toHaveBeenCalled();
    });

    it("routes failed updates to the injected logger instead of console", () => {
      const logger = { warn: vi.fn(), error: vi.fn() };
      const manager = new GSI({ logger });

      manager.update("{broken json}");

      expect(logger.error).toHaveBeenCalledOnce();
      expect(console.error).not.toHaveBeenCalled();
    });

    it("routes listener exceptions to the injected logger instead of console", () => {
      const logger = { warn: vi.fn(), error: vi.fn() };
      const manager = new GSI({ logger });

      manager.on("update", () => {
        throw new Error("listener boom");
      });
      manager.update(payload);

      expect(logger.error).toHaveBeenCalledOnce();
      expect(console.error).not.toHaveBeenCalled();
    });
  });

  describe("emitUpdateOnNoop: false", () => {
    it("suppresses 'update' when an identical full payload arrives (heartbeat)", () => {
      const manager = new GSI({ emitUpdateOnNoop: false });

      manager.update(payload);

      const listener = vi.fn();

      manager.on("update", listener);
      manager.update(clonePayload(payload));

      expect(listener).not.toHaveBeenCalled();
    });

    it("suppresses 'update' for an identical partial heartbeat", () => {
      const manager = new GSI({ emitUpdateOnNoop: false });

      manager.update(payload);

      const listener = vi.fn();

      manager.on("update", listener);
      manager.update({ round: manager.state.round });

      expect(listener).not.toHaveBeenCalled();
    });

    it("keeps the same state reference across a no-op update", () => {
      const manager = new GSI({ emitUpdateOnNoop: false });

      manager.update(payload);

      const before = manager.state;

      manager.update(clonePayload(payload));

      expect(manager.state).toBe(before);
    });

    it("still emits 'update' when something changed", () => {
      const manager = new GSI({ emitUpdateOnNoop: false });

      manager.update(payload);

      const listener = vi.fn();

      manager.on("update", listener);
      manager.update(withPlayerHealth(67));

      expect(listener).toHaveBeenCalledOnce();
    });

    it("still emits block and granular events on real changes", () => {
      const manager = new GSI({ emitUpdateOnNoop: false });

      manager.update(payload);

      const blockSpy = vi.fn();
      const granularSpy = vi.fn();

      manager.on("player", blockSpy);
      manager.on("player:state:health", granularSpy);
      manager.update(withPlayerHealth(67));

      expect(blockSpy).toHaveBeenCalledOnce();
      expect(granularSpy).toHaveBeenCalledWith({ previous: 100, current: 67 });
    });

    it("reset() still emits 'update' even with suppression on", () => {
      const manager = new GSI({ emitUpdateOnNoop: false });

      manager.update(payload);

      const listener = vi.fn();

      manager.on("update", listener);
      manager.reset();

      expect(listener).toHaveBeenCalledOnce();
      expect(listener).toHaveBeenCalledWith({});
    });
  });

  describe("payload edge cases", () => {
    it("allplayers: {} empties the roster and emits allplayers:left for everyone", () => {
      const manager = new GSI();

      manager.update(payload);

      const left = vi.fn();

      manager.on("allplayers:left", left);
      manager.update({ allplayers: {} });

      expect(manager.state.allplayers).toEqual({});
      expect(left).toHaveBeenCalledOnce();
      expect([...left.mock.calls[0][0].current].sort((a, b) => a.localeCompare(b))).toEqual([
        "76561198000000001",
        "76561198000000002",
        "76561198000000003",
      ]);
    });

    it("allplayers.custom never reaches state or pollutes roster events", () => {
      const manager = new GSI();

      manager.update(payload);

      const joined = vi.fn();

      manager.on("allplayers:joined", joined);

      const p = clonePayload(payload);

      p.allplayers = {
        ...p.allplayers,
        "76561198000000099": {
          ...p.allplayers!["76561198000000002"]!,
          steamid: "76561198000000099",
          name: "NiKo",
        },
        custom: { joined: ["76561198000000099"], left: [] },
      } as typeof p.allplayers;

      manager.update(p);

      expect(manager.state.allplayers).not.toHaveProperty("custom");
      // If "custom" leaked into the roster, deriveEvents would report it as
      // a second joined SteamID.
      expect(joined).toHaveBeenCalledOnce();
      expect(joined).toHaveBeenCalledWith({
        previous: undefined,
        current: ["76561198000000099"],
      });
    });

    it("a player who leaves and reappears fires left then joined and restores state", () => {
      const manager = new GSI();

      manager.update(payload);

      const joined = vi.fn();
      const left = vi.fn();

      manager.on("allplayers:joined", joined);
      manager.on("allplayers:left", left);

      manager.update(withoutPlayer("76561198000000003"));

      expect(left).toHaveBeenCalledWith({
        previous: undefined,
        current: ["76561198000000003"],
      });
      expect(joined).not.toHaveBeenCalled();

      manager.update(clonePayload(payload));

      expect(joined).toHaveBeenCalledWith({
        previous: undefined,
        current: ["76561198000000003"],
      });
      expect(manager.state.allplayers?.["76561198000000003"]).toBeDefined();
    });
  });

  describe("derived events", () => {
    it("fires round:ended in granular mode (default)", () => {
      const manager = new GSI();

      manager.update(payload); // round: live

      const listener = vi.fn();

      manager.on("round:ended", listener);

      const p = clonePayload(payload);

      p.round = { phase: "over", win_team: "CT" };
      manager.update(p);

      expect(listener).toHaveBeenCalledOnce();
      expect(listener).toHaveBeenCalledWith({
        winner: "CT",
        bomb: undefined,
        round: payload.map!.round,
      });
    });

    it("fires bomb:planted in block mode", () => {
      const manager = new GSI({ changeDetection: "block" });

      manager.update(payload);

      const listener = vi.fn();

      manager.on("bomb:planted", listener);

      const p = clonePayload(payload);

      p.bomb = { state: "planted", player: "76561198000000003" };
      manager.update(p);

      expect(listener).toHaveBeenCalledOnce();
      expect(listener).toHaveBeenCalledWith({
        player: "76561198000000003",
        countdown: undefined,
      });
    });

    it("fires player:killed in minimal mode", () => {
      const manager = new GSI({ changeDetection: "minimal" });

      manager.update(payload); // round_kills: 2

      const listener = vi.fn();

      manager.on("player:killed", listener);
      manager.update(withPlayerKills(3, 2));

      expect(listener).toHaveBeenCalledOnce();
      expect(listener).toHaveBeenCalledWith({
        steamid: "76561198000000001",
        name: "s1mple",
        kills: 1,
        headshots: 1,
        round_kills: 3,
      });
    });

    it("fires player:died when the observed player's health hits 0", () => {
      const manager = new GSI();

      manager.update(payload);

      const listener = vi.fn();

      manager.on("player:died", listener);
      manager.update(withPlayerHealth(0));

      expect(listener).toHaveBeenCalledOnce();
      expect(listener).toHaveBeenCalledWith({
        steamid: "76561198000000001",
        name: "s1mple",
      });
    });

    it("does not fire on the very first update (cold start)", () => {
      const manager = new GSI();

      const roundStarted = vi.fn();
      const bombPlanted = vi.fn();

      manager.on("round:started", roundStarted);
      manager.on("bomb:planted", bombPlanted);

      const p = clonePayload(payload);

      p.bomb = { state: "planted" };
      manager.update(p); // round already "live", bomb already "planted"

      expect(roundStarted).not.toHaveBeenCalled();
      expect(bombPlanted).not.toHaveBeenCalled();
    });

    it("does not fire when nothing crosses a threshold", () => {
      const manager = new GSI();

      manager.update(payload);

      const listeners = {
        started: vi.fn(),
        ended: vi.fn(),
        planted: vi.fn(),
        defused: vi.fn(),
        exploded: vi.fn(),
        died: vi.fn(),
        killed: vi.fn(),
      };

      manager.on("round:started", listeners.started);
      manager.on("round:ended", listeners.ended);
      manager.on("bomb:planted", listeners.planted);
      manager.on("bomb:defused", listeners.defused);
      manager.on("bomb:exploded", listeners.exploded);
      manager.on("player:died", listeners.died);
      manager.on("player:killed", listeners.killed);

      manager.update(withPlayerHealth(67)); // unrelated change

      for (const listener of Object.values(listeners)) {
        expect(listener).not.toHaveBeenCalled();
      }
    });

    it("a lone derived-event listener does not trigger a granular diff of its block", () => {
      const manager = new GSI();

      manager.update(payload);

      manager.on("round:ended", vi.fn());

      const mapSpy = vi.fn();

      // If "round:ended" were mistaken for granular interest in "round", this
      // would start receiving deep-diff-derived events it never asked for —
      // block events fire on any content change, so this checks the block
      // listener stays quiet on an update that only touches `map`.
      manager.on("map", mapSpy);

      const p = clonePayload(payload);

      p.round = { phase: "over" };
      manager.update(p);

      expect(mapSpy).not.toHaveBeenCalled();
    });

    it("reset() does not fire derived events (nothing to transition into)", () => {
      const manager = new GSI();

      manager.update(payload);

      const listener = vi.fn();

      manager.on("round:ended", listener);
      manager.reset();

      expect(listener).not.toHaveBeenCalled();
    });

    it("emitUpdateOnNoop: false does not suppress derived events on a real transition", () => {
      const manager = new GSI({ emitUpdateOnNoop: false });

      manager.update(payload);

      const listener = vi.fn();

      manager.on("bomb:exploded", listener);

      const p = clonePayload(payload);

      p.bomb = { state: "exploded", position: "-100.0, 200.0, 0.0" };
      manager.update(p);

      expect(listener).toHaveBeenCalledOnce();
    });
  });
});
