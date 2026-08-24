import type { CSSProperties, MouseEventHandler } from "react";

export interface StatBarProps {
  value?: number;
  max?: number;
  color?: string;
  trackColor?: string;
  width?: number;
  height?: number;
  label?: string;
  style?: CSSProperties;
  onClick?: MouseEventHandler<HTMLDivElement>;
  selected?: boolean;
  [dataAttr: `data-${string}`]: unknown;
}

export function StatBar(props: StatBarProps) {
  const {
    value = 0,
    max = 100,
    color = "#a3e635",
    trackColor = "#1c2029",
    width = 80,
    height = 6,
    label,
    style,
    onClick,
    selected,
    ...dataAttrs
  } = props;

  const pct = Math.max(0, Math.min(100, (value / max) * 100));

  return (
    <div
      onClick={onClick}
      data-part="stat-bar"
      {...dataAttrs}
      {...(selected ? { "data-selected": "" } : {})}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        cursor: onClick ? "pointer" : undefined,
        ...style,
      }}
    >
      <div
        style={{
          width,
          height,
          borderRadius: height / 2,
          background: trackColor,
          overflow: "hidden",
        }}
      >
        <div style={{ width: `${pct}%`, height: "100%", background: color }} />
      </div>
      {label !== undefined ? (
        <span style={{ fontSize: 11, fontWeight: 700, color, minWidth: 20, textAlign: "right" }}>
          {label}
        </span>
      ) : null}
    </div>
  );
}
