import { useState } from "react";

import { MinimapFromGSI, useMinimapSpec } from "../components/minimap/minimap-from-gsi.tsx";
import {
  PlayerCardFromGSI,
  usePlayerCardSpec,
} from "../components/player-card/player-card-from-gsi.tsx";
import {
  RoundTimerFromGSI,
  useRoundTimerSpec,
} from "../components/round-timer/round-timer-from-gsi.tsx";
import {
  useWeaponHudSpec,
  WeaponHudFromGSI,
} from "../components/weapon-hud/weapon-hud-from-gsi.tsx";
import { findNode } from "../hud/spec/find-node.ts";
import { useOverridesStore } from "../hud/overrides/use-overrides-store.ts";
import type { SpecNode } from "../hud/spec/types.ts";
import { CatalogSidebar } from "./catalog-sidebar.tsx";
import { PropertiesPanel } from "./properties-panel.tsx";

const WIDGET_LABELS: Record<string, string> = {
  "player-card": "Player Card",
  "round-timer": "Round Timer",
  minimap: "Minimap",
  "weapon-hud": "Weapon HUD",
};

/**
 * The real editor built from the catalog + subtree-styling mechanism: a
 * catalog sidebar, a canvas of the four live widgets (each independently
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
  const { overrides, patchNode, resetNode } = useOverridesStore();

  const playerCard = usePlayerCardSpec();
  const roundTimer = useRoundTimerSpec();
  const weaponHud = useWeaponHudSpec();
  const minimap = useMinimapSpec();

  let matchedRoot: SpecNode | undefined;
  let found: ReturnType<typeof findNode> | undefined;

  for (const spec of [playerCard, roundTimer, weaponHud, minimap]) {
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
        <div>
          <h1 style={{ margin: 0, fontSize: 16, color: "#f3f4f6" }}>CS2 GSI Overlay — Editor</h1>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#565a66" }}>
            Clique em qualquer elemento — inclusive dentro do Player Card — pra selecionar e editar.
          </p>
        </div>

        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start" }}>
          <RoundTimerFromGSI
            overrides={overrides}
            selectedId={selectedId}
            onSelectNode={setSelectedId}
          />
          <MinimapFromGSI
            overrides={overrides}
            selectedId={selectedId}
            onSelectNode={setSelectedId}
          />
          <WeaponHudFromGSI
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
