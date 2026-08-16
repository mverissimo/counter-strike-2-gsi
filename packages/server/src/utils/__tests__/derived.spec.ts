import { describe, it, expect } from "vitest";

import type { SchemaPayload } from "@counter-strike-2-gsi/types";

import { deriveEvents } from "../derived";
import { payload, clonePayload } from "../../../tests/fixtures";

/** Finds one derived event by name, or undefined. */
function find(events: ReturnType<typeof deriveEvents>, name: string) {
  return events.find((e) => e.event === name);
}

describe("@server/utils: deriveEvents", () => {
  describe("cold start", () => {
    it("emits nothing when previous is empty, even if current already looks like a transition", () => {
      const current: SchemaPayload = {
        round: { phase: "live" },
        bomb: { state: "planted" },
        player: {
          steamid: "76561198000000001",
          state: { ...payload.player!.state!, health: 0, round_kills: 5 },
        },
      };

      expect(deriveEvents({}, current)).toEqual([]);
    });

    it("emits nothing on two identical empty states", () => {
      expect(deriveEvents({}, {})).toEqual([]);
    });

    it("still emits allplayers:joined on cold start, unlike the milestone events", () => {
      // Roster membership is level-triggered: a HUD attaching mid-match
      // should be able to seed its scoreboard from the very first payload,
      // unlike round/bomb/player which are edge-triggered transitions.
      const current: SchemaPayload = { allplayers: payload.allplayers };

      const events = deriveEvents({}, current);

      expect(events).toEqual([
        {
          event: "allplayers:joined",
          payload: {
            previous: undefined,
            current: expect.arrayContaining([
              "76561198000000001",
              "76561198000000002",
              "76561198000000003",
            ]),
          },
        },
      ]);
      expect(find(events, "round:started")).toBeUndefined();
    });
  });

  describe("round:started", () => {
    it("fires when phase flips to live from something else", () => {
      const previous: SchemaPayload = { round: { phase: "freezetime" }, map: payload.map };
      const current: SchemaPayload = { round: { phase: "live" }, map: payload.map };

      const event = find(deriveEvents(previous, current), "round:started");

      expect(event).toEqual({
        event: "round:started",
        payload: { round: payload.map!.round },
      });
    });

    it("does not fire when phase was already live", () => {
      const previous: SchemaPayload = { round: { phase: "live" } };
      const current: SchemaPayload = { round: { phase: "live" } };

      expect(find(deriveEvents(previous, current), "round:started")).toBeUndefined();
    });

    it("does not fire on a phase change that isn't into live", () => {
      const previous: SchemaPayload = { round: { phase: "freezetime" } };
      const current: SchemaPayload = { round: { phase: "warmup" } };

      expect(find(deriveEvents(previous, current), "round:started")).toBeUndefined();
    });
  });

  describe("round:ended", () => {
    it("fires when phase flips to over, carrying winner and bomb outcome", () => {
      const previous: SchemaPayload = { round: { phase: "live" }, map: payload.map };
      const current: SchemaPayload = {
        round: { phase: "over", win_team: "CT", bomb: "defused" },
        map: payload.map,
      };

      const event = find(deriveEvents(previous, current), "round:ended");

      expect(event).toEqual({
        event: "round:ended",
        payload: { winner: "CT", bomb: "defused", round: payload.map!.round },
      });
    });

    it("does not fire when phase was already over", () => {
      const previous: SchemaPayload = { round: { phase: "over" } };
      const current: SchemaPayload = { round: { phase: "over" } };

      expect(find(deriveEvents(previous, current), "round:ended")).toBeUndefined();
    });

    it("round:started and round:ended never fire together on the same transition", () => {
      const previous: SchemaPayload = { round: { phase: "live" } };
      const current: SchemaPayload = { round: { phase: "over" } };

      const events = deriveEvents(previous, current);

      expect(find(events, "round:started")).toBeUndefined();
      expect(find(events, "round:ended")).toBeDefined();
    });
  });

  describe("bomb events", () => {
    it("bomb:planted fires on the transition into planted", () => {
      const previous: SchemaPayload = { bomb: { state: "planting" } };
      const current: SchemaPayload = {
        bomb: { state: "planted", player: "76561198000000003", countdown: "40.0" },
      };

      expect(find(deriveEvents(previous, current), "bomb:planted")).toEqual({
        event: "bomb:planted",
        payload: { player: "76561198000000003", countdown: "40.0" },
      });
    });

    it("bomb:planted fires even when the bomb block had no previous observation", () => {
      // Documented best-effort behavior: a heartbeat skipped over "planting",
      // or the component only just started reporting. Still a real fact
      // becoming true on this tick, from the manager's point of view.
      const previous: SchemaPayload = { round: { phase: "live" } };
      const current: SchemaPayload = { round: { phase: "live" }, bomb: { state: "planted" } };

      expect(find(deriveEvents(previous, current), "bomb:planted")).toBeDefined();
    });

    it("bomb:defused fires on the transition into defused", () => {
      const previous: SchemaPayload = { bomb: { state: "defusing" } };
      const current: SchemaPayload = { bomb: { state: "defused", player: "76561198000000001" } };

      expect(find(deriveEvents(previous, current), "bomb:defused")).toEqual({
        event: "bomb:defused",
        payload: { player: "76561198000000001" },
      });
    });

    it("bomb:exploded fires on the transition into exploded", () => {
      const previous: SchemaPayload = { bomb: { state: "planted" } };
      const current: SchemaPayload = {
        bomb: { state: "exploded", position: "-123.4, 456.7, 89.0" },
      };

      expect(find(deriveEvents(previous, current), "bomb:exploded")).toEqual({
        event: "bomb:exploded",
        payload: { position: "-123.4, 456.7, 89.0" },
      });
    });

    it("does not fire any bomb event when state is unchanged", () => {
      const previous: SchemaPayload = { bomb: { state: "carried" } };
      const current: SchemaPayload = { bomb: { state: "carried" } };

      const events = deriveEvents(previous, current);

      expect(find(events, "bomb:planted")).toBeUndefined();
      expect(find(events, "bomb:defused")).toBeUndefined();
      expect(find(events, "bomb:exploded")).toBeUndefined();
    });

    it("only the crossed state fires, not every bomb event", () => {
      const previous: SchemaPayload = { bomb: { state: "planting" } };
      const current: SchemaPayload = { bomb: { state: "planted" } };

      const events = deriveEvents(previous, current).filter((e) => e.event.startsWith("bomb:"));

      expect(events).toHaveLength(1);
      expect(events[0]!.event).toBe("bomb:planted");
    });
  });

  describe("player:died", () => {
    it("fires when the observed player's health drops to 0", () => {
      const previous = clonePayload(payload);
      const current = clonePayload(payload);

      current.player!.state!.health = 0;

      expect(find(deriveEvents(previous, current), "player:died")).toEqual({
        event: "player:died",
        payload: { steamid: "76561198000000001", name: "s1mple" },
      });
    });

    it("does not fire when health drops but not to 0", () => {
      const previous = clonePayload(payload);
      const current = clonePayload(payload);

      current.player!.state!.health = 40;

      expect(find(deriveEvents(previous, current), "player:died")).toBeUndefined();
    });

    it("does not fire when health was already 0 (no transition)", () => {
      const previous = clonePayload(payload);
      const current = clonePayload(payload);

      previous.player!.state!.health = 0;
      current.player!.state!.health = 0;

      expect(find(deriveEvents(previous, current), "player:died")).toBeUndefined();
    });

    it("does not fire across an observer switch to a different steamid", () => {
      const previous = clonePayload(payload);
      const current = clonePayload(payload);

      current.player = {
        steamid: "76561198000000099",
        name: "NiKo",
        state: { ...payload.player!.state!, health: 0 },
      };

      expect(find(deriveEvents(previous, current), "player:died")).toBeUndefined();
    });

    it("does not fire when the player block only just appeared already dead", () => {
      const previous: SchemaPayload = { round: { phase: "live" } };
      const current: SchemaPayload = {
        round: { phase: "live" },
        player: { steamid: "76561198000000001", state: { ...payload.player!.state!, health: 0 } },
      };

      expect(find(deriveEvents(previous, current), "player:died")).toBeUndefined();
    });
  });

  describe("player:killed", () => {
    it("fires when round_kills goes up, with kills/headshots/round_kills computed", () => {
      const previous = clonePayload(payload); // round_kills: 2, round_killhs: 1
      const current = clonePayload(payload);

      current.player!.state!.round_kills = 3;
      current.player!.state!.round_killhs = 2;

      expect(find(deriveEvents(previous, current), "player:killed")).toEqual({
        event: "player:killed",
        payload: {
          steamid: "76561198000000001",
          name: "s1mple",
          kills: 1,
          headshots: 1,
          round_kills: 3,
        },
      });
    });

    it("collapses simultaneous frags into one event with kills > 1", () => {
      const previous = clonePayload(payload); // round_kills: 2
      const current = clonePayload(payload);

      current.player!.state!.round_kills = 4;
      current.player!.state!.round_killhs = 1; // unchanged

      expect(find(deriveEvents(previous, current), "player:killed")).toEqual({
        event: "player:killed",
        payload: {
          steamid: "76561198000000001",
          name: "s1mple",
          kills: 2,
          headshots: 0,
          round_kills: 4,
        },
      });
    });

    it("does not fire when round_kills resets at the start of a new round", () => {
      const previous = clonePayload(payload); // round_kills: 2
      const current = clonePayload(payload);

      current.player!.state!.round_kills = 0;
      current.player!.state!.round_killhs = 0;

      expect(find(deriveEvents(previous, current), "player:killed")).toBeUndefined();
    });

    it("still fires when a reset and the new round's first kill land in the same tick", () => {
      // round_kills only ever decreases via a round reset, never otherwise —
      // so a drop to a nonzero value means the counter reset to 0 and then
      // picked up a kill before this payload was observed. The old baseline
      // (kills from the round that just ended) doesn't apply to it.
      const previous = clonePayload(payload); // round_kills: 2, round_killhs: 1
      const current = clonePayload(payload);

      current.player!.state!.round_kills = 1;
      current.player!.state!.round_killhs = 1;

      expect(find(deriveEvents(previous, current), "player:killed")).toEqual({
        event: "player:killed",
        payload: {
          steamid: "76561198000000001",
          name: "s1mple",
          kills: 1,
          headshots: 1,
          round_kills: 1,
        },
      });
    });

    it("collapses a reset plus multiple new-round kills into one event", () => {
      const previous = clonePayload(payload); // round_kills: 2

      const current = clonePayload(payload);

      current.player!.state!.round_kills = 3;
      current.player!.state!.round_killhs = 2;

      // Reset happened, then 3 kills (2 of them headshots) landed before the
      // next observed tick.
      previous.player!.state!.round_kills = 5;
      previous.player!.state!.round_killhs = 4;

      expect(find(deriveEvents(previous, current), "player:killed")).toEqual({
        event: "player:killed",
        payload: {
          steamid: "76561198000000001",
          name: "s1mple",
          kills: 3,
          headshots: 2,
          round_kills: 3,
        },
      });
    });

    it("does not fire when round_kills is unchanged", () => {
      const previous = clonePayload(payload);
      const current = clonePayload(payload);

      expect(find(deriveEvents(previous, current), "player:killed")).toBeUndefined();
    });

    it("does not fire across an observer switch to a different steamid", () => {
      const previous = clonePayload(payload); // round_kills: 2
      const current = clonePayload(payload);

      current.player = {
        steamid: "76561198000000099",
        name: "NiKo",
        state: { ...payload.player!.state!, round_kills: 5, round_killhs: 3 },
      };

      expect(find(deriveEvents(previous, current), "player:killed")).toBeUndefined();
    });

    it("clamps headshots at 0 rather than going negative across round_killhs resets", () => {
      const previous = clonePayload(payload);

      previous.player!.state!.round_kills = 4;
      previous.player!.state!.round_killhs = 3;

      const current = clonePayload(payload);

      // round_kills still goes up (carried over oddly) but round_killhs reset lower.
      current.player!.state!.round_kills = 5;
      current.player!.state!.round_killhs = 0;

      const event = find(deriveEvents(previous, current), "player:killed");

      expect(event?.payload).toMatchObject({ headshots: 0 });
    });
  });

  describe("multiple derived events in one transition", () => {
    it("reports every crossed milestone from a single payload", () => {
      const previous = clonePayload(payload);

      previous.round = { phase: "live" };
      previous.bomb = { state: "planting" };

      const current = clonePayload(payload);

      current.round = { phase: "over", win_team: "T", bomb: "planted" };
      current.bomb = { state: "planted" };
      current.player!.state!.health = 0;

      const events = deriveEvents(previous, current);
      const names = events.map((e) => e.event).sort();

      expect(names).toEqual(["bomb:planted", "player:died", "round:ended"]);
    });
  });

  describe("allplayers:joined / allplayers:left (roster events)", () => {
    it("fires allplayers:joined for a new SteamID", () => {
      const previous = clonePayload(payload);
      const current = clonePayload(payload);

      current.allplayers = {
        ...current.allplayers,
        "76561198000000099": {
          ...current.allplayers!["76561198000000002"]!,
          steamid: "76561198000000099",
        },
      } as typeof current.allplayers;

      expect(find(deriveEvents(previous, current), "allplayers:joined")).toEqual({
        event: "allplayers:joined",
        payload: { previous: undefined, current: ["76561198000000099"] },
      });
    });

    it("fires allplayers:left for a removed SteamID", () => {
      const previous = clonePayload(payload);
      const current = clonePayload(payload);

      delete current.allplayers!["76561198000000003"];

      expect(find(deriveEvents(previous, current), "allplayers:left")).toEqual({
        event: "allplayers:left",
        payload: { previous: undefined, current: ["76561198000000003"] },
      });
    });

    it("does not fire when the roster is unchanged", () => {
      const previous = clonePayload(payload);
      const current = clonePayload(payload);

      const events = deriveEvents(previous, current);

      expect(find(events, "allplayers:joined")).toBeUndefined();
      expect(find(events, "allplayers:left")).toBeUndefined();
    });

    it("filters the flattened allplayers.custom bookkeeping key out of both sides", () => {
      const previous = clonePayload(payload);
      const current = clonePayload(payload);

      current.allplayers = {
        ...current.allplayers,
        custom: { joined: [], left: [] },
      } as typeof current.allplayers;

      const events = deriveEvents(previous, current);

      expect(find(events, "allplayers:joined")).toBeUndefined();
      expect(find(events, "allplayers:left")).toBeUndefined();
    });

    it("fires alongside milestone events in the same transition", () => {
      const previous = clonePayload(payload);
      const current = clonePayload(payload);

      current.round = { phase: "over", win_team: "CT" };
      current.allplayers = {
        ...current.allplayers,
        "76561198000000099": {
          ...current.allplayers!["76561198000000002"]!,
          steamid: "76561198000000099",
        },
      } as typeof current.allplayers;

      const names = deriveEvents(previous, current)
        .map((e) => e.event)
        .sort();

      expect(names).toEqual(["allplayers:joined", "round:ended"]);
    });
  });
});
