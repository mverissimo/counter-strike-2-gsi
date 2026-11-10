import { z } from "zod";
import { playerCardProps } from "./catalog";

export const canvas = { width: 1920, height: 1080 } as const;
export const elementNames = [
  "Match score",
  "Player card",
  "Team roster",
  "Kill feed",
  "Text label",
] as const;
export type ElementName = (typeof elementNames)[number];
export const playerBindings = z.object({
  playerId: z.string().default("borrow"),
});
const baseElement = z.object({
  id: z.string().min(1),
  visible: z.boolean(),
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().positive().max(canvas.width),
  height: z.number().positive().max(canvas.height),
  text: z.string().max(500),
  fontSize: z.number().min(8).max(200),
});
export const elementSchema = z.discriminatedUnion("kind", [
  baseElement.extend({
    kind: z.literal("Player card"),
    component: z.literal("player-card"),
    width: z.number().min(240).max(canvas.width),
    height: z.number().min(160).max(canvas.height),
    props: playerCardProps,
    bindings: playerBindings,
  }),
  baseElement.extend({ kind: z.enum(["Match score", "Team roster", "Kill feed", "Text label"]) }),
]);
export type EditorElement = z.infer<typeof elementSchema>;
export type PlayerElement = Extract<EditorElement, { kind: "Player card" }>;
export type ElementProperties = Pick<
  EditorElement,
  "x" | "y" | "width" | "height" | "text" | "fontSize"
>;
export const sceneSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  visible: z.boolean(),
  locked: z.boolean(),
  elements: z.array(elementSchema),
});
export type EditorScene = z.infer<typeof sceneSchema>;
export const documentSchema = z
  .object({
    version: z.literal(1),
    canvas: z.object({ width: z.literal(1920), height: z.literal(1080) }),
    scenes: z.array(sceneSchema),
  })
  .superRefine((document, ctx) => {
    const sceneIds = new Set<string>();
    const elementIds = new Set<string>();
    for (const scene of document.scenes) {
      if (sceneIds.has(scene.id)) ctx.addIssue({ code: "custom", message: "Duplicate scene ID" });
      sceneIds.add(scene.id);
      const kinds = new Set<ElementName>();
      for (const item of scene.elements) {
        if (kinds.has(item.kind))
          ctx.addIssue({
            code: "custom",
            message: "Only one element of each type is allowed per scene",
          });
        kinds.add(item.kind);
        if (elementIds.has(item.id))
          ctx.addIssue({ code: "custom", message: "Duplicate element ID" });
        elementIds.add(item.id);
        if (
          item.x < 0 ||
          item.y < 0 ||
          item.x + item.width > canvas.width ||
          item.y + item.height > canvas.height
        ) {
          ctx.addIssue({ code: "custom", message: "Element is outside the canvas" });
        }
      }
    }
  });
export type HudDocument = z.infer<typeof documentSchema>;

export function createElement(kind: ElementName, id: string): EditorElement {
  const base = {
    id,
    visible: true,
    x: 160,
    y: 160,
    width: 600,
    height: 120,
    text: "Text label",
    fontSize: 32,
  };
  return kind === "Player card"
    ? {
        ...base,
        kind,
        component: "player-card",
        width: 360,
        height: 280,
        props: playerCardProps.parse({}),
        bindings: playerBindings.parse({}),
      }
    : { ...base, kind };
}

export function constrainGeometry(
  element: EditorElement,
  patch: Partial<ElementProperties>,
): EditorElement {
  const next = { ...element, ...patch };
  const minWidth = element.kind === "Player card" ? 240 : 1;
  const minHeight = element.kind === "Player card" ? 160 : 1;
  next.width = Math.round(Math.max(minWidth, Math.min(canvas.width, next.width)));
  next.height = Math.round(Math.max(minHeight, Math.min(canvas.height, next.height)));
  next.x = Math.round(Math.max(0, Math.min(canvas.width - next.width, next.x)));
  next.y = Math.round(Math.max(0, Math.min(canvas.height - next.height, next.y)));
  return next;
}

export const initialDocument: HudDocument = {
  version: 1,
  canvas,
  scenes: [
    {
      id: "broadcast",
      name: "Match broadcast",
      visible: true,
      locked: false,
      elements: [createElement("Player card", "broadcast-player")],
    },
    { id: "minimal", name: "Minimal HUD", visible: true, locked: false, elements: [] },
  ],
};
export function serializeDocument(document: HudDocument) {
  return JSON.stringify(documentSchema.parse(document));
}
export function parseDocument(json: string) {
  return documentSchema.parse(JSON.parse(json));
}
