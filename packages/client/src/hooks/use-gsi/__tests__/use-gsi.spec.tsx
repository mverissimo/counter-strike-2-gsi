// @vitest-environment happy-dom
// Declared here rather than relying on the package's vite config: the root
// `vp test` run uses the root config, where the default environment is node.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, renderHook, screen } from "@testing-library/react";
import type { ReactNode } from "react";

import {
  GSIProvider,
  useGSIClient,
  useGSIEvent,
  useGSIEvents,
  useGSIState,
  useGSIStatus,
} from "../use-gsi";
import { MockEventSource } from "./helpers/mock-event-source";

beforeEach(() => {
  MockEventSource.reset();
  vi.stubGlobal("EventSource", MockEventSource);
});

afterEach(() => {
  // Auto-cleanup only registers itself when vitest globals are on.
  cleanup();
  vi.unstubAllGlobals();
});

function wrapper({ children }: { children: ReactNode }) {
  return <GSIProvider url="http://gsi.test/sse">{children}</GSIProvider>;
}

/** Push a server event through the live EventSource. */
function emit(event: string, data: unknown) {
  act(() => {
    MockEventSource.latest().emit(event, data);
  });
}

describe("@client: useGSIState", () => {
  it("returns undefined before the first update", () => {
    const { result } = renderHook(() => useGSIState(), { wrapper });

    expect(result.current).toBeUndefined();
  });

  it("returns the last full update payload", () => {
    const { result } = renderHook(() => useGSIState(), { wrapper });

    emit("update", { round: { phase: "live" }, map: { name: "de_inferno" } });

    expect(result.current).toEqual({ round: { phase: "live" }, map: { name: "de_inferno" } });

    emit("update", { round: { phase: "over" } });

    expect(result.current).toEqual({ round: { phase: "over" } });
  });
});

describe("@client: useGSIEvents", () => {
  it("returns the current value of every requested event", () => {
    const { result } = renderHook(
      () => useGSIEvents(["player:state:health", "round:phase"] as const),
      { wrapper },
    );

    emit("player:state:health", { previous: 100, current: 80 });
    emit("round:phase", { previous: "freezetime", current: "live" });

    expect(result.current).toEqual({
      "player:state:health": 80,
      "round:phase": "live",
    });
  });

  it("leaves events that have not fired as undefined", () => {
    const { result } = renderHook(
      () => useGSIEvents(["player:state:health", "round:phase"] as const),
      { wrapper },
    );

    emit("round:phase", { current: "live" });

    expect(result.current["player:state:health"]).toBeUndefined();
    expect(result.current["round:phase"]).toBe("live");
  });

  it("keeps the same object reference until one of the events fires", () => {
    const { result, rerender } = renderHook(
      () => useGSIEvents(["player:state:health", "round:phase"] as const),
      { wrapper },
    );

    const initial = result.current;

    rerender();

    expect(result.current).toBe(initial);

    // An event nobody in this hook subscribes to must not churn the object.
    emit("bomb:state", { current: "planted" });

    expect(result.current).toBe(initial);

    emit("round:phase", { current: "live" });

    expect(result.current).not.toBe(initial);
  });

  it("subscribes one native listener per requested event", () => {
    renderHook(() => useGSIEvents(["player:state:health", "round:phase"] as const), { wrapper });

    expect(MockEventSource.latest().listenerCount("player:state:health")).toBe(1);
    expect(MockEventSource.latest().listenerCount("round:phase")).toBe(1);
  });
});

describe("@client: store lifecycle", () => {
  function Probe() {
    const health = useGSIEvent("player:state:health");
    const status = useGSIStatus();
    const { clear, disconnect } = useGSIClient();

    return (
      <div>
        <span data-testid="health">{String(health)}</span>
        <span data-testid="status">{status}</span>
        <button onClick={() => disconnect()}>disconnect</button>
        <button onClick={() => clear()}>clear</button>
      </div>
    );
  }

  it("keeps the last known value across a disconnect", () => {
    render(<Probe />, { wrapper });

    emit("player:state:health", { current: 42 });

    expect(screen.getByTestId("health").textContent).toBe("42");

    act(() => {
      screen.getByText("disconnect").click();
    });

    expect(screen.getByTestId("status").textContent).toBe("disconnected");
    expect(screen.getByTestId("health").textContent).toBe("42");
  });

  it("clear() drops the cached values and re-renders subscribers", () => {
    render(<Probe />, { wrapper });

    emit("player:state:health", { current: 42 });

    expect(screen.getByTestId("health").textContent).toBe("42");

    act(() => {
      screen.getByText("clear").click();
    });

    expect(screen.getByTestId("health").textContent).toBe("undefined");
  });

  it("clear() does not tear down the subscription", () => {
    render(<Probe />, { wrapper });

    emit("player:state:health", { current: 42 });

    act(() => {
      screen.getByText("clear").click();
    });

    emit("player:state:health", { current: 7 });

    expect(screen.getByTestId("health").textContent).toBe("7");
  });
});
