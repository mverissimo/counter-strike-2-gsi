import { defineRegistry, Renderer, JSONUIProvider } from "@json-render/react";
import { hudCatalog } from "./catalog";
import { canvas, type EditorElement, type EditorScene } from "./document";
import { resolvePlayerProps, type MockPlayer } from "./mock-data";

const { registry } = defineRegistry(hudCatalog, {
  components: {
    "player-card": ({ props }) => (
      <article
        data-component="player-card"
        className="flex size-full min-w-0 flex-col overflow-hidden rounded-lg bg-zinc-950 font-sans text-white tabular-nums"
        aria-label={`Player card: ${props.playerName}`}
      >
        {props.showPortrait && (
          <div className="flex min-h-0 flex-1 items-center justify-center bg-zinc-900">
            {props.portrait ? (
              <img
                src={props.portrait}
                alt=""
                draggable={false}
                className="h-full max-h-full w-full object-contain"
              />
            ) : (
              <span className="text-5xl font-bold">{props.playerName.slice(0, 1)}</span>
            )}
          </div>
        )}
        <div
          className="flex min-h-16 flex-1 items-center justify-between gap-4 px-5"
          style={{ backgroundColor: props.accentColor }}
        >
          {props.showName && (
            <span className="truncate text-3xl font-extrabold uppercase text-zinc-950">
              {props.playerName}
            </span>
          )}
          {props.showHealth && (
            <span
              className="text-2xl font-bold text-zinc-950"
              aria-label={`Health: ${props.health}`}
            >
              {props.health}
              <span className="ml-1 text-xs">HP</span>
            </span>
          )}
        </div>
        {props.showHealth && (
          <div
            role="meter"
            aria-label="Health"
            aria-valuenow={props.health}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-2 shrink-0 bg-zinc-800"
          >
            <div
              className="h-full"
              style={{ width: `${props.health}%`, backgroundColor: props.accentColor }}
            />
          </div>
        )}
        {props.showArmor && (
          <div className="flex h-9 shrink-0 items-center gap-3 bg-zinc-900 px-4">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              Armor
            </span>
            <div
              role="meter"
              aria-label="Armor"
              aria-valuenow={props.armor}
              aria-valuemin={0}
              aria-valuemax={100}
              className="h-1 flex-1 bg-zinc-700"
            >
              <div className="h-full bg-slate-300" style={{ width: `${props.armor}%` }} />
            </div>
            <span className="text-xs">{props.armor}</span>
          </div>
        )}
      </article>
    ),
  },
});

export function ElementContent({
  element,
  players,
  editing = false,
}: {
  element: EditorElement;
  players: readonly MockPlayer[];
  editing?: boolean;
}) {
  if (element.kind === "Player card") {
    return (
      <JSONUIProvider registry={registry}>
        <Renderer
          registry={registry}
          spec={{
            root: element.id,
            elements: {
              [element.id]: {
                type: element.component,
                props: resolvePlayerProps(element, players),
                children: [],
              },
            },
          }}
        />
      </JSONUIProvider>
    );
  }
  if (element.kind === "Text label")
    return (
      <div
        className="size-full overflow-hidden"
        style={{ color: "white", fontSize: element.fontSize }}
      >
        {element.text}
      </div>
    );
  return editing ? (
    <div className="flex size-full items-center justify-center border border-dashed border-border text-sm text-muted-foreground">
      {element.kind} · Placeholder
    </div>
  ) : null;
}

export function HudRenderer({
  scene,
  players,
}: {
  scene: EditorScene | undefined;
  players: readonly MockPlayer[];
}) {
  return (
    <div
      data-slot="hud-scene"
      className="relative overflow-hidden"
      style={{ width: canvas.width, height: canvas.height }}
    >
      {scene?.visible &&
        scene.elements
          .filter((element) => element.visible)
          .map((element) => (
            <div
              key={element.id}
              data-element-id={element.id}
              className="absolute overflow-hidden"
              style={{
                left: element.x,
                top: element.y,
                width: element.width,
                height: element.height,
              }}
            >
              <ElementContent element={element} players={players} />
            </div>
          ))}
    </div>
  );
}
