import type { CSSProperties, MouseEventHandler } from "react";

export interface AvatarProps {
  initial?: string;
  color?: string;
  size?: number;
  style?: CSSProperties;
  onClick?: MouseEventHandler<HTMLDivElement>;
  selected?: boolean;
}

export function Avatar(props: AvatarProps) {
  const { initial = "?", color = "#3a3f4d", size = 28, style, onClick, selected } = props;

  return (
    <div
      onClick={onClick}
      style={{
        flex: "0 0 auto",
        width: size,
        height: size,
        borderRadius: "50%",
        background: color,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.4,
        fontWeight: 700,
        color: "#0a0b0f",
        cursor: onClick ? "pointer" : undefined,
        outline: selected ? "2px solid #22d3ee" : undefined,
        outlineOffset: selected ? 2 : undefined,
        ...style,
      }}
    >
      {initial}
    </div>
  );
}
