import { describe, expect, it } from "vitest";

import { GSI } from "../gsi";

describe("@server: public contracts", () => {
  it("publishes deeply readonly, frozen snapshots without freezing caller input", () => {
    const manager = new GSI();
    const input = { round: { phase: "live" } };

    manager.update(input);
    const snapshot = manager.state;

    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.round)).toBe(true);
    expect(Reflect.set(snapshot.round ?? {}, "phase", "over")).toBe(false);
    expect(snapshot.round?.phase).toBe("live");
    expect(Object.isFrozen(input.round)).toBe(false);

    manager.update({ round: { phase: "over" } });
    expect(manager.state.round?.phase).toBe("over");
    expect(snapshot.round?.phase).toBe("live");
    manager.reset();
    expect(Object.isFrozen(manager.state)).toBe(true);
  });
});
