import type { CSSProperties } from "react";

const WIDGETS = [
  { id: "player-card", label: "Player Card", badge: "PC", accent: "#60a5fa" },
  { id: "round-timer", label: "Round Timer", badge: "RT", accent: "#22d3ee" },
  { id: "minimap", label: "Minimap", badge: "MM", accent: "#22d3ee" },
  { id: "weapon-hud", label: "Weapon HUD", badge: "WH", accent: "#facc15" },
  { id: "kill-feed", label: "Kill Feed", badge: "KF", accent: "#f472b6" },
];

const PRIMITIVES = [
  { badge: "ST", label: "Stack", hint: "flex container" },
  { badge: "TX", label: "Text", hint: "valor + estilo" },
  { badge: "AV", label: "Avatar", hint: "inicial + cor" },
  { badge: "SB", label: "StatBar", hint: "barra + número" },
];

const sectionTitle: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.1em",
  color: "#565a66",
  textTransform: "uppercase",
  margin: "4px 4px 10px",
};

function itemStyle(active: boolean, interactive: boolean): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 9px",
    borderRadius: 7,
    border: "1px solid " + (active ? "#2b2f3a" : "transparent"),
    background: active ? "#14161e" : "transparent",
    cursor: interactive ? "pointer" : "default",
    textAlign: "left",
    width: "100%",
  };
}

function badge(color: string, outline?: boolean): CSSProperties {
  return {
    flex: "0 0 auto",
    width: 30,
    height: 30,
    borderRadius: 6,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    fontSize: 10.5,
    background: outline ? "transparent" : color,
    border: outline ? "1px solid #3a3f4d" : undefined,
    color: outline ? "#9199a8" : "#0a0b0f",
  };
}

/**
 * Two catalog groups, matching what's actually true today: "Widgets" are
 * the five composed catalog entries with a real `use*Spec()` hook behind
 * them; "Primitivos" are reference-only — they compose widgets, but this
 * editor has no drag-and-drop yet (see the mockup this was built from),
 * so listing them as clickable would promise something that doesn't work.
 *
 * Kill Feed only shows the observed player's own kills — `player:killed`
 * has no killer/victim pair — so its rows read "name — kill", never
 * "name killed name". That's a real ceiling, not a placeholder.
 */
export function CatalogSidebar(props: {
  activeRootId: string | undefined;
  onSelect: (id: string) => void;
}) {
  const { activeRootId, onSelect } = props;

  return (
    <aside
      style={{
        width: 250,
        flex: "0 0 auto",
        borderRight: "1px solid #23262f",
        background: "#0d0e13",
        padding: "14px 12px",
        overflowY: "auto",
      }}
    >
      <div style={sectionTitle}>Widgets</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {WIDGETS.map((w) => (
          <button
            key={w.id}
            onClick={() => onSelect(w.id)}
            style={itemStyle(activeRootId === w.id, true)}
          >
            <span style={badge(w.accent)}>{w.badge}</span>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: "#dfe1e6" }}>{w.label}</span>
          </button>
        ))}
      </div>

      <div style={{ ...sectionTitle, marginTop: 18 }}>Primitivos</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {PRIMITIVES.map((p) => (
          <div key={p.badge} style={itemStyle(false, false)}>
            <span style={badge("", true)}>{p.badge}</span>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: "#dfe1e6" }}>{p.label}</div>
              <div style={{ fontSize: 10.5, color: "#565a66" }}>{p.hint}</div>
            </div>
          </div>
        ))}
      </div>
      <p style={{ fontSize: 10, color: "#4a4e59", margin: "12px 4px 0", lineHeight: "140%" }}>
        Primitivos compõem os widgets acima — sem drag-and-drop ainda, não são posicionáveis direto
        no canvas.
      </p>
    </aside>
  );
}
