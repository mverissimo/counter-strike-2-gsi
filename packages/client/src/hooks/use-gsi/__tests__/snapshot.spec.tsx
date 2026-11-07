// @vitest-environment happy-dom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

import {
  GSIProvider,
  useGSIDelta,
  useGSIEvent,
  useGSIEvents,
  useGSISelector,
  useGSIState,
} from "../use-gsi";
import { MockEventSource } from "./helpers/mock-event-source";

beforeEach(() => {
  MockEventSource.reset();
  vi.stubGlobal("EventSource", MockEventSource);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function wrapper({ children }: { children: ReactNode }) {
  return <GSIProvider url="http://gsi.test/sse">{children}</GSIProvider>;
}

describe("@client: snapshot consistency", () => {
  it("reads nested values from parent events without an explicit parent hook", () => {
    const { result } = renderHook(() => useGSIEvent("player:state:health"), { wrapper });

    act(() => MockEventSource.latest().emit("player", { current: { state: { health: 80 } } }));
    expect(result.current).toBe(80);

    act(() => MockEventSource.latest().emit("player", { previous: { state: { health: 80 } } }));
    expect(result.current).toBeUndefined();
  });

  it("does not rewrite an earlier full snapshot when a delta arrives", () => {
    const { result } = renderHook(
      () => ({
        health: useGSIEvent("player:state:health"),
        snapshot: useGSIState(),
      }),
      { wrapper },
    );

    act(() => MockEventSource.latest().emit("update", { player: { state: { health: 100 } } }));
    const snapshot = result.current.snapshot;
    act(() => MockEventSource.latest().emit("player:state:health", { current: 50 }));

    expect(result.current.health).toBe(50);
    expect(snapshot?.player?.state?.health).toBe(100);
    expect(result.current.snapshot).toBe(snapshot);
  });

  it("does not render an unchanged primitive on a full snapshot", () => {
    const renders = vi.fn();
    renderHook(
      () => {
        renders();
        return useGSIEvent("player:state:health");
      },
      { wrapper },
    );

    act(() => MockEventSource.latest().emit("update", { player: { state: { health: 100 } } }));
    const count = renders.mock.calls.length;
    act(() =>
      MockEventSource.latest().emit("update", {
        player: { state: { health: 100 } },
        round: { phase: "live" },
      }),
    );

    expect(renders).toHaveBeenCalledTimes(count);
  });

  it("retains an equal selector result across snapshots", () => {
    const { result } = renderHook(
      () =>
        useGSISelector(
          "player:state:health",
          (health) => ({ alive: (health ?? 0) > 0 }),
          (previous, current) => previous.alive === current.alive,
        ),
      { wrapper },
    );

    act(() => MockEventSource.latest().emit("update", { player: { state: { health: 100 } } }));
    const selected = result.current;
    act(() => MockEventSource.latest().emit("update", { player: { state: { health: 80 } } }));
    expect(result.current).toBe(selected);
  });

  it("replaces stale granular values on a newer full snapshot", () => {
    const { result } = renderHook(() => useGSIEvent("player:state:health"), { wrapper });

    act(() => MockEventSource.latest().emit("player:state:health", { current: 80 }));
    act(() => MockEventSource.latest().emit("update", { player: { state: { health: 60 } } }));
    expect(result.current).toBe(60);
  });

  it("retains the last actual transition when a snapshot removes its value", () => {
    const { result } = renderHook(
      () => ({
        value: useGSIEvent("player:state:health"),
        delta: useGSIDelta("player:state:health"),
      }),
      { wrapper },
    );

    act(() => MockEventSource.latest().emit("player:state:health", { previous: 100, current: 80 }));
    const transition = result.current.delta;
    act(() => MockEventSource.latest().emit("update", {}));

    expect(result.current.value).toBeUndefined();
    expect(result.current.delta).toBe(transition);
  });

  it("changes result keys when switching between paths with equal values", () => {
    type Event = "player:state:health" | "player:state:armor";
    const { result, rerender } = renderHook(
      ({ event }: { event: Event }) => useGSIEvents([event]),
      { wrapper, initialProps: { event: "player:state:health" as Event } },
    );

    act(() =>
      MockEventSource.latest().emit("update", {
        player: { state: { health: 100, armor: 100 } },
      }),
    );
    expect(result.current).toEqual({ "player:state:health": 100 });

    rerender({ event: "player:state:armor" });
    expect(result.current).toEqual({ "player:state:armor": 100 });
  });
});
