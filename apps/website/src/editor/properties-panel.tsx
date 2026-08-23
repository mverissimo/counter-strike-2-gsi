import type { CSSProperties, ReactNode } from "react";

import type { SpecOverrides } from "../hud/spec/apply-overrides.ts";
import type { SpecNode } from "../hud/spec/types.ts";

const PALETTE = ["#22d3ee", "#facc15", "#fb923c", "#a3e635", "#f472b6", "#60a5fa"];

const panelStyle: CSSProperties = {
  width: 300,
  flex: "0 0 auto",
  borderLeft: "1px solid #23262f",
  background: "#0d0e13",
  padding: "16px 16px 20px",
  overflowY: "auto",
};

function Section(props: { title: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.08em",
          color: "#565a66",
          textTransform: "uppercase",
          marginBottom: 9,
        }}
      >
        {props.title}
      </div>
      {props.children}
    </div>
  );
}

/**
 * Bound to whatever node id is currently selected across every widget's
 * spec tree (see `editor-page.tsx`'s `findNode` walk). The "Patch" section
 * at the bottom renders the literal `{ [nodeId]: overrides[nodeId] }` —
 * exactly the shape `applyOverrides(spec, overrides)` consumes — so this
 * panel never drifts from what the code actually does with a click.
 */
export function PropertiesPanel(props: {
  node: SpecNode | undefined;
  parent: SpecNode | undefined;
  rootLabel: string | undefined;
  overrides: SpecOverrides;
  patchNode: (nodeId: string, patch: SpecOverrides[string]) => void;
  resetNode: (nodeId: string) => void;
}) {
  const { node, parent, rootLabel, overrides, patchNode, resetNode } = props;

  if (!node) {
    return (
      <aside style={panelStyle}>
        <p style={{ fontSize: 12, color: "#565a66" }}>
          Nada selecionado — clique em um elemento no canvas.
        </p>
      </aside>
    );
  }

  const override = overrides[node.id];
  const overrideColor = (override?.props as { color?: string } | undefined)?.color;
  const baseColor = (node.props as { color?: string } | undefined)?.color;
  const accent = overrideColor ?? baseColor ?? "#22d3ee";
  const visible = override?.visible !== false;
  const gsi = node.gsi ?? [];
  const patchJson = override ? JSON.stringify({ [node.id]: override }, null, 2) : null;
  // `node.id` is namespaced as `${widget}:${local}` (see player-card-spec.ts) so
  // overrides stay scoped per widget instance; the breadcrumb only needs the local part.
  const localId = node.id.includes(":") ? node.id.slice(node.id.indexOf(":") + 1) : node.id;

  return (
    <aside style={panelStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <div
          style={{ width: 34, height: 34, borderRadius: 7, background: accent, flex: "0 0 auto" }}
        />
        <div>
          <div
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: "0.08em",
              color: "#7d818c",
              textTransform: "uppercase",
            }}
          >
            {node.type}
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#f3f4f6" }}>
            {parent && rootLabel ? (
              <>
                {rootLabel}
                <span style={{ color: "#4a4e59", margin: "0 4px", fontWeight: 500 }}>›</span>
                <span style={{ color: "#67e8f9" }}>{localId}</span>
              </>
            ) : (
              (rootLabel ?? localId)
            )}
          </div>
        </div>
      </div>

      <Section title="Vinculado ao GSI">
        {gsi.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {gsi.map((path) => (
              <div
                key={path}
                style={{
                  fontFamily: "ui-monospace, 'SF Mono', Consolas, monospace",
                  fontSize: 11,
                  color: "#a3e635",
                  background: "#0f1a0a",
                  border: "1px solid #22381a",
                  borderRadius: 5,
                  padding: "7px 9px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {path}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 11.5, color: "#565a66", fontStyle: "italic" }}>
            nó composto — sem binding direto, ver filhos
          </div>
        )}
      </Section>

      <Section title="Cor de destaque">
        <div style={{ display: "flex", gap: 8 }}>
          {PALETTE.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={`cor ${color}`}
              onClick={() => patchNode(node.id, { props: { color } })}
              style={{
                width: 26,
                height: 26,
                borderRadius: "50%",
                background: color,
                cursor: "pointer",
                padding: 0,
                border: color === accent ? "2px solid #f3f4f6" : "2px solid transparent",
              }}
            />
          ))}
        </div>
      </Section>

      <Section title="Visibilidade">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            border: "1px solid #23262f",
            background: "#131620",
            borderRadius: 6,
            padding: "8px 10px",
          }}
        >
          <span style={{ fontSize: 12.5, color: "#c7cad1" }}>Exibir no HUD</span>
          <button
            type="button"
            onClick={() => (visible ? patchNode(node.id, { visible: false }) : resetNode(node.id))}
            style={{
              fontSize: 12,
              fontWeight: 600,
              padding: "5px 10px",
              borderRadius: 5,
              border: "1px solid #23262f",
              background: "#0d0e13",
              color: visible ? "#a3e635" : "#7d818c",
              cursor: "pointer",
            }}
          >
            {visible ? "Esconder" : "Mostrar"}
          </button>
        </div>
      </Section>

      <Section title="Patch (applyOverrides)">
        {patchJson ? (
          <pre
            style={{
              margin: 0,
              fontFamily: "ui-monospace, 'SF Mono', Consolas, monospace",
              fontSize: 11,
              lineHeight: "150%",
              color: "#d3f99d",
              background: "#0d0f14",
              border: "1px solid #23262f",
              borderRadius: 6,
              padding: "10px 11px",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {patchJson}
          </pre>
        ) : (
          <div style={{ fontSize: 11.5, color: "#565a66", fontStyle: "italic" }}>
            nenhum override ainda — mude a cor ou a visibilidade
          </div>
        )}
        <p style={{ fontSize: 10, color: "#4a4e59", marginTop: 8, lineHeight: "140%" }}>
          É o segundo argumento real de applyOverrides(spec, overrides) — persistido em
          localStorage.
        </p>
      </Section>
    </aside>
  );
}
