import { useState } from "react";

import { KillFeedFromGSI, useKillFeedSpec } from "../components/kill-feed/kill-feed-from-gsi.tsx";
import {
  MapRotationFromGSI,
  useMapRotationSpec,
} from "../components/map-rotation/map-rotation-from-gsi.tsx";
import {
  MatchInfoFromGSI,
  useMatchInfoSpec,
} from "../components/match-info/match-info-from-gsi.tsx";
import {
  PlayerCardFromGSI,
  usePlayerCardSpec,
} from "../components/player-card/player-card-from-gsi.tsx";
import { SponsorsFromGSI, useSponsorsSpec } from "../components/sponsors/sponsors-from-gsi.tsx";
import { findNode } from "../hud/spec/find-node.ts";
import { useOverridesStore } from "../hud/overrides/use-overrides-store.ts";
import type { SpecNode } from "../hud/spec/types.ts";
import { CatalogSidebar } from "./catalog-sidebar.tsx";
import { PropertiesPanel } from "./properties-panel.tsx";

const WIDGET_LABELS: Record<string, string> = {
  "player-card": "Player Card",
  "kill-feed": "Kill Feed",
  "match-info": "Match Info",
  "map-rotation": "Map Rotation",
  sponsors: "Sponsors",
};

/**
 * The real editor built from the catalog + subtree-styling mechanism: a
 * catalog sidebar, a canvas of the five live widgets (each independently
 * clickable down to its leaf nodes — see `SpecRenderer`/the primitives'
 * `onClick`/`selected` props), and a properties panel bound to whatever
 * node id is currently selected, wherever it lives in whichever widget's
 * tree.
 *
 * No drag-and-drop or resize here — that's `@dnd-kit/react` +
 * `@snapgridjs/react` territory, deliberately out of scope for now.
 */
export function EditorPage() {
  const [selectedId, setSelectedId] = useState("player-card");
  const { overrides, status, patchNode, resetNode } = useOverridesStore();

  const matchInfo = useMatchInfoSpec();
  const mapRotation = useMapRotationSpec();
  const sponsors = useSponsorsSpec();
  const playerCard = usePlayerCardSpec();
  const killFeed = useKillFeedSpec();

  let matchedRoot: SpecNode | undefined;
  let found: ReturnType<typeof findNode> | undefined;

  for (const spec of [matchInfo, mapRotation, sponsors, playerCard, killFeed]) {
    if (!spec) continue;

    const result = findNode(spec, selectedId);

    if (result) {
      matchedRoot = spec;
      found = result;
      break;
    }
  }

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        background: "#0a0b0f",
        color: "#c7cad1",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <CatalogSidebar activeRootId={matchedRoot?.id} onSelect={setSelectedId} />

      <main
        style={{
          flex: "1 1 auto",
          display: "flex",
          flexDirection: "column",
          padding: 32,
          gap: 28,
          overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 16, color: "#f3f4f6" }}>CS2 GSI Overlay — Editor</h1>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "#565a66" }}>
              Clique em qualquer elemento — inclusive dentro do Player Card — pra selecionar e
              editar.
            </p>
          </div>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: status === "offline" ? "#f87171" : status === "saving" ? "#facc15" : "#4ade80",
            }}
          >
            {status === "loading" && "carregando…"}
            {status === "saving" && "salvando…"}
            {status === "saved" && "overrides salvos"}
            {status === "offline" && "servidor de overrides fora do ar — rode pnpm mock"}
          </span>
        </div>

        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start" }}>
          <MapRotationFromGSI
            overrides={overrides}
            selectedId={selectedId}
            onSelectNode={setSelectedId}
          />
          <MatchInfoFromGSI
            overrides={overrides}
            selectedId={selectedId}
            onSelectNode={setSelectedId}
          />
          <SponsorsFromGSI
            overrides={overrides}
            selectedId={selectedId}
            onSelectNode={setSelectedId}
          />
        </div>

        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start" }}>
          <KillFeedFromGSI
            overrides={overrides}
            selectedId={selectedId}
            onSelectNode={setSelectedId}
          />
        </div>

        <PlayerCardFromGSI
          overrides={overrides}
          selectedId={selectedId}
          onSelectNode={setSelectedId}
        />
      </main>

      <PropertiesPanel
        node={found?.node}
        parent={found?.parent}
        rootLabel={matchedRoot ? WIDGET_LABELS[matchedRoot.id] : undefined}
        overrides={overrides}
        patchNode={patchNode}
        resetNode={resetNode}
      />
    </div>
  );
}
