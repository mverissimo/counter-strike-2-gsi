import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  constrainGeometry,
  createElement,
  initialDocument,
  parseDocument,
  serializeDocument,
} from "../document";
import { mockPlayers, editMockPlayer, resolvePlayerProps } from "../mock-data";
import { HudRenderer } from "../renderer";

function player(id = "one") {
  const item = createElement("Player card", id);
  if (item.kind !== "Player card") throw new Error("Expected player card");
  return item;
}
describe("Player Card workflow", () => {
  it("edits a shared mock player without changing other players or the HUD document", () => {
    const one = player();
    const two = player("two");
    two.bindings.playerId = "kernel";
    const before = JSON.stringify([one, two]);
    const updated = editMockPlayer(mockPlayers, "borrow", {
      name: "Captain",
      health: 46,
      armor: 30,
      portrait: "",
    });
    expect(resolvePlayerProps(one, updated)).toMatchObject({
      playerName: "Captain",
      health: 46,
      armor: 30,
      portrait: "",
    });
    expect(resolvePlayerProps(two, updated)).toMatchObject({ playerName: "kernel", health: 64 });
    expect(updated[0]!.id).toBe("borrow");
    expect(mockPlayers[0]!.health).toBe(86);
    expect(JSON.stringify([one, two])).toBe(before);
  });
  it("rejects invalid mock data without changing the player", () => {
    expect(editMockPlayer(mockPlayers, "borrow", { health: 101 })).toEqual(mockPlayers);
    expect(editMockPlayer(mockPlayers, "borrow", { armor: NaN })).toEqual(mockPlayers);
    expect(editMockPlayer(mockPlayers, "borrow", { name: "" })).toEqual(mockPlayers);
    expect(editMockPlayer(mockPlayers, "missing", { health: 30 })).toEqual(mockPlayers);
  });
  it("allows one instance per type in each scene, including hidden elements", () => {
    const document = parseDocument(serializeDocument(initialDocument));
    document.scenes[0]!.elements[0]!.visible = false;
    document.scenes[0]!.elements.push(player("duplicate"));
    expect(() => serializeDocument(document)).toThrow("Only one element of each type");
    document.scenes[0]!.elements.pop();
    document.scenes[1]!.elements.push(player("another-scene"));
    expect(parseDocument(serializeDocument(document))).toEqual(document);
  });
  it("falls back to literal props when a player is absent", () => {
    const item = player();
    item.props.playerName = "Stand-in";
    expect(resolvePlayerProps(item, [])).toMatchObject({
      playerName: "Stand-in",
      health: 100,
      portrait: "",
    });
  });
  it("round trips the versioned document and rejects invalid props and geometry", () => {
    const restored = parseDocument(serializeDocument(initialDocument));
    expect(restored).toEqual(initialDocument);
    const item = restored.scenes[0]!.elements[0]!;
    if (item.kind !== "Player card") throw new Error("Expected player card");
    item.props.health = 200;
    expect(() => serializeDocument(restored)).toThrow();
    item.props.health = 50;
    item.width = 10;
    expect(() => serializeDocument(restored)).toThrow();
    item.width = 360;
    item.x = 1920;
    expect(() => serializeDocument(restored)).toThrow();
    expect(() => parseDocument('{"version":2}')).toThrow();
  });
  it("clamps edits to the artboard and enforces minimum card size", () => {
    expect(constrainGeometry(player(), { x: -50, y: 1100, width: 20, height: 10 })).toMatchObject({
      x: 0,
      y: 920,
      width: 240,
      height: 160,
    });
    expect(
      constrainGeometry(player(), { x: 1900, y: 1000, width: 500, height: 300 }),
    ).toMatchObject({ x: 1420, y: 780 });
  });
  it("renders a standalone scene without React Flow or editor providers", () => {
    const document = parseDocument(serializeDocument(initialDocument));
    const html = renderToStaticMarkup(
      <HudRenderer scene={document.scenes[0]} players={mockPlayers} />,
    );
    expect(html).toContain('data-component="player-card"');
    expect(html).toContain("Health: 86");
    expect(html).not.toContain("react-flow");
    const scene = document.scenes[0]!;
    scene.elements[0]!.visible = false;
    expect(renderToStaticMarkup(<HudRenderer scene={scene} players={mockPlayers} />)).not.toContain(
      'data-component="player-card"',
    );
    scene.elements[0]!.visible = true;
    scene.visible = false;
    expect(renderToStaticMarkup(<HudRenderer scene={scene} players={mockPlayers} />)).not.toContain(
      'data-component="player-card"',
    );
  });
});
