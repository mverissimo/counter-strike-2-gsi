import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GSIProvider, useGSIClient, useGSIDelta, useGSIEvent, useGSIStatus } from "../../use-sse";
import { MockEventSource } from "../helpers/mock-event-source";

interface OnRender {
  onRender?: () => void;
}

beforeEach(() => {
  MockEventSource.reset();
  vi.stubGlobal("EventSource", MockEventSource);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function HP({ onRender }: OnRender) {
  const hp = useGSIEvent("player:state:health");

  onRender?.();

  return <div data-testid="hp">{JSON.stringify(hp) ?? "—"}</div>;
}

function Phase({ onRender }: OnRender) {
  const phase = useGSIEvent("round:phase");
  onRender?.();
  return <div data-testid="phase">{JSON.stringify(phase) ?? "—"}</div>;
}

function Status() {
  return <div data-testid="status">{useGSIStatus()}</div>;
}

describe("@client: hooks", () => {
  describe("useGSIEvent", () => {
    it("throws when used outside <GSIProvider>", () => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});

      expect(() => render(<HP />)).toThrow(/GSIProvider/);

      spy.mockRestore();
    });

    it("renders the current value when an event arrives", () => {
      render(
        <GSIProvider url="http://x">
          <HP />
        </GSIProvider>,
      );

      act(() => {
        MockEventSource.latest().open();
        MockEventSource.latest().emit("player:state:health", {
          previous: 100,
          current: 80,
        });
      });

      expect(screen.getByTestId("hp").textContent).toBe("80");
    });

    it("does not re-render components subscribed to other events", () => {
      const hpRender = vi.fn();
      const phaseRender = vi.fn();

      render(
        <GSIProvider url="http://x">
          <HP onRender={hpRender} />
          <Phase onRender={phaseRender} />
        </GSIProvider>,
      );

      act(() => MockEventSource.latest().open());

      const hpRendersBefore = hpRender.mock.calls.length;
      const phaseRendersBefore = phaseRender.mock.calls.length;

      act(() => {
        MockEventSource.latest().emit("round:phase", {
          previous: "freezetime",
          current: "live",
        });
      });

      expect(phaseRender.mock.calls.length).toBeGreaterThan(phaseRendersBefore);
      expect(hpRender.mock.calls.length).toBe(hpRendersBefore);
    });
  });

  describe("useGSIDelta", () => {
    it("returns the full { previous, current } delta", () => {
      const seen: unknown[] = [];

      function Probe() {
        const delta = useGSIDelta("player:state:health");

        seen.push(delta);

        return null;
      }

      render(
        <GSIProvider url="http://x">
          <Probe />
        </GSIProvider>,
      );

      act(() => {
        MockEventSource.latest().open();
        MockEventSource.latest().emit("player:state:health", {
          previous: 100,
          current: 80,
        });
      });

      expect(seen.at(-1)).toEqual({
        previous: 100,
        current: 80,
      });
    });
  });

  describe("useGSIStatus", () => {
    it("reports connecting → connected transitions", () => {
      render(
        <GSIProvider url="http://x">
          <Status />
        </GSIProvider>,
      );

      expect(screen.getByTestId("status").textContent).toBe("connecting");

      act(() => MockEventSource.latest().open());

      expect(screen.getByTestId("status").textContent).toBe("connected");
    });
  });

  describe("lazy subscription & ref-counting", () => {
    it("opens the connection only when the first hook mounts", () => {
      const { rerender } = render(<GSIProvider url="http://x">{null}</GSIProvider>);

      expect(MockEventSource.instances).toHaveLength(0);

      rerender(
        <GSIProvider url="http://x">
          <HP />
        </GSIProvider>,
      );

      expect(MockEventSource.instances).toHaveLength(1);
    });

    it("closes the connection when the last subscriber unmounts", () => {
      const { unmount } = render(
        <GSIProvider url="http://x">
          <HP />
        </GSIProvider>,
      );

      expect(MockEventSource.latest().readyState).toBe(MockEventSource.CONNECTING);

      unmount();

      expect(MockEventSource.latest().readyState).toBe(MockEventSource.CLOSED);
    });

    it("attaches a native listener only for events that are subscribed", () => {
      render(
        <GSIProvider url="http://x">
          <HP />
        </GSIProvider>,
      );

      const src = MockEventSource.latest();

      expect(src.listenerCount("player:state:health")).toBe(1);
      expect(src.listenerCount("round:phase")).toBe(0);
    });

    it("detaches the native listener when all components using it unmount", () => {
      function Toggle({ show }: { show: boolean }) {
        return show ? <HP /> : null;
      }

      const { rerender } = render(
        <GSIProvider url="http://x">
          <Toggle show={true} />
          {/* Keep the provider alive with another hook so the connection stays open */}
          <Status />
        </GSIProvider>,
      );

      const src = MockEventSource.latest();
      expect(src.listenerCount("player:state:health")).toBe(1);

      rerender(
        <GSIProvider url="http://x">
          <Toggle show={false} />
          <Status />
        </GSIProvider>,
      );

      expect(src.listenerCount("player:state:health")).toBe(0);
    });
  });

  describe("useGSIClient", () => {
    it("exposes manual connect/disconnect", () => {
      let api: ReturnType<typeof useGSIClient> | null = null;

      function Controls() {
        api = useGSIClient();
        return null;
      }

      render(
        <GSIProvider url="http://x">
          <HP />
          <Controls />
        </GSIProvider>,
      );

      expect(MockEventSource.latest().readyState).toBe(MockEventSource.CONNECTING);

      act(() => api!.disconnect());

      expect(MockEventSource.latest().readyState).toBe(MockEventSource.CLOSED);
    });
  });
});
