import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { GSI } from "../gsi";
import { payload, clonePayload } from "../../tests/fixtures";

// ---------------------------------------------------------------------------
// Helpers — always produce fully-valid payloads so ArkType never warns
// ---------------------------------------------------------------------------

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

      it("emits no granular or allplayers events even when players join", () => {
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
        expect(joinedSpy).not.toHaveBeenCalled();
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

    it("emits 'error' in strict mode when the payload fails schema validation", () => {
      const manager = new GSI({
        strictValidation: true,
      });
      const listener = vi.fn();

      manager.on("error", listener);

      manager.update({
        player: {
          state: {
            health: 999,
          },
        },
      });

      expect(listener).toHaveBeenCalledOnce();
      expect(listener.mock.calls[0][0].error.message).toContain("GSI validation failed");
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
});
