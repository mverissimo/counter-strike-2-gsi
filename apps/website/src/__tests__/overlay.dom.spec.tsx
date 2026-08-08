// @vitest-environment happy-dom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GSIProvider } from "@counter-strike-2-gsi/client";

import type { SchemaPayload } from "@counter-strike-2-gsi/types";

import { Overlay } from "../overlay.tsx";
import { MockEventSource } from "./helpers/mock-event-source.ts";

beforeEach(() => {
  MockEventSource.reset();
  vi.stubGlobal("EventSource", MockEventSource);
});

afterEach(() => {
  // `globals` is off, so Testing Library's automatic cleanup never registers —
  // without this each render stacks another overlay into the same document.
  cleanup();
  vi.unstubAllGlobals();
});

function player(name: string, team: "CT" | "T", slot: number, health: number) {
  return {
    name,
    team,
    observer_slot: slot,
    state: {
      health,
      armor: 100,
      helmet: true,
      flashed: 0,
      smoked: 0,
      burning: 0,
      money: 3000,
      round_kills: 0,
      round_killhs: 0,
      equip_value: 3800,
    },
    match_stats: {
      kills: 1,
      assists: 0,
      deaths: 2,
      mvps: 0,
      score: 3,
    },
  };
}

function payload(overrides: Partial<SchemaPayload> = {}): SchemaPayload {
  return {
    map: {
      mode: "competitive",
      name: "de_mirage",
      phase: "live",
      round: 7,
      team_ct: {
        name: "Vitality",
        score: 4,
        consecutive_round_losses: 0,
        timeouts_remaining: 1,
        matches_won_this_series: 0,
      },
      team_t: {
        name: "NAVI",
        score: 2,
        consecutive_round_losses: 1,
        timeouts_remaining: 1,
        matches_won_this_series: 0,
      },
      round_wins: {
        "1": "ct_win_elimination",
        "2": "t_win_bomb",
      },
      num_matches_to_win_series: 1,
    },
    round: {
      phase: "live",
    },
    phase_countdowns: {
      phase: "live",
      phase_ends_in: "94.7",
    },
    player: {
      steamid: "76561197960265729",
      name: "dev_null",
      team: "CT",
      state: {
        health: 62,
        armor: 88,
        helmet: true,
        flashed: 0,
        smoked: 0,
        burning: 0,
        money: 5400,
        round_kills: 2,
        round_killhs: 1,
        equip_value: 4700,
        defuse_kit: true,
      },
      weapons: {
        weapon_0: {
          name: "weapon_knife",
          type: "Knife",
          paintkit: "default",
          state: "holstered",
        },
        weapon_1: {
          name: "weapon_ak47",
          type: "Rifle",
          paintkit: "default",
          state: "active",
          ammo_clip: 7,
          ammo_clip_max: 30,
          ammo_reserve: 60,
        },
      },
    },
    allplayers: {
      "76561197960265729": player("dev_null", "CT", 0, 62),
      "76561197960265730": player("segfault", "CT", 1, 0),
      "76561197960265731": player("heap", "T", 0, 100),
    },
    ...overrides,
  } as SchemaPayload;
}

function mount() {
  render(
    <GSIProvider url="http://gsi.test/sse">
      <Overlay />
    </GSIProvider>,
  );

  const source = MockEventSource.latest();

  act(() => {
    source.open();
  });

  return source;
}

describe("@website: Overlay", () => {
  it("shows the connection badge and no HUD before any payload arrives", () => {
    mount();

    expect(screen.getByText("waiting for game")).toBeTruthy();
    expect(screen.queryByText("de_mirage")).toBeNull();
  });

  it("paints the whole HUD from a single 'update' snapshot", () => {
    const source = mount();

    act(() => {
      source.emit("update", payload());
    });

    // Scoreboard: both scores, map, round, and the phase clock.
    expect(screen.getByText("Vitality")).toBeTruthy();
    expect(screen.getByText("NAVI")).toBeTruthy();
    expect(screen.getByText("4")).toBeTruthy();
    expect(screen.getByText("de_mirage")).toBeTruthy();
    expect(screen.getByText("round 7")).toBeTruthy();
    expect(screen.getByText("1:34")).toBeTruthy();

    // Player panel: health, money, weapon and ammo. The observed player also
    // appears in the CT roster, so two matches is correct here.
    expect(screen.getAllByText("dev_null")).toHaveLength(2);
    expect(screen.getByText("62")).toBeTruthy();
    expect(screen.getByText("$5,400")).toBeTruthy();
    expect(screen.getByText("AK47")).toBeTruthy();
    expect(screen.getByText("7")).toBeTruthy();

    // Rosters, including the dead CT.
    expect(screen.getByText("segfault")).toBeTruthy();
    expect(screen.getByText("heap")).toBeTruthy();
  });

  it("marks dead players so CSS can grey the row out", () => {
    const source = mount();

    act(() => {
      source.emit("update", payload());
    });

    const dead = screen.getByText("segfault").closest("[data-alive]");

    expect(dead?.getAttribute("data-alive")).toBe("false");
  });

  it("keeps the weapon on screen while it is reloading", () => {
    const source = mount();

    const reloading = payload();

    // CS2 flips the held weapon's state to "reloading" for the animation; no
    // weapon reports "active" during that window.
    (reloading.player!.weapons as Record<string, { state: string }>).weapon_1.state = "reloading";

    act(() => {
      source.emit("update", reloading);
    });

    expect(screen.getByText("AK47")).toBeTruthy();
    expect(screen.getByText("7")).toBeTruthy();
  });

  it("draws a fill inside every stat bar, not just the empty track", () => {
    const source = mount();

    act(() => {
      source.emit("update", payload());
    });

    const tracks = [...document.querySelectorAll<HTMLElement>("[data-tone='health']")];

    expect(tracks.length).toBeGreaterThan(0);

    // The track is only the groove. `--pct` sizes a child element, so a track
    // rendered childless is a bar that never moves off zero — which looks like
    // a styling choice from the outside and passes every other assertion here.
    for (const track of tracks) {
      expect(track.children).toHaveLength(1);
    }

    // 62 HP on the observed player, in both the panel and the CT roster.
    const sixtyTwo = tracks.filter((t) => t.style.getPropertyValue("--pct") === "0.62");

    expect(sixtyTwo).toHaveLength(2);
  });

  it("renders the bomb timer only once the bomb is planted", () => {
    const source = mount();

    act(() => {
      source.emit("update", payload());
    });

    expect(screen.queryByText("planted")).toBeNull();

    act(() => {
      source.emit(
        "update",
        payload({
          bomb: {
            state: "planted",
            countdown: "31.4",
          },
        }),
      );
    });

    expect(screen.getByText("planted")).toBeTruthy();
    expect(screen.getByText("31.4")).toBeTruthy();
  });

  it("keeps the last frame when the stream drops", () => {
    const source = mount();

    act(() => {
      source.emit("update", payload());
    });

    act(() => {
      source.readyState = MockEventSource.CLOSED;
      source.onerror?.(new Event("error"));
    });

    // The HUD must hold its last frame through a reconnect rather than
    // blanking out — only the badge should change.
    expect(screen.getByText("de_mirage")).toBeTruthy();
    expect(screen.getByText("no signal")).toBeTruthy();
  });
});
