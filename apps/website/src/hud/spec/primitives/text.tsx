import type { CSSProperties, MouseEventHandler } from "react";

export interface TextProps {
  value?: string | number;
  size?: number;
  weight?: CSSProperties["fontWeight"];
  color?: string;
  style?: CSSProperties;
  onClick?: MouseEventHandler<HTMLSpanElement>;
  selected?: boolean;
}

export function Text(props: TextProps) {
  const { value, size = 12, weight = 500, color, style, onClick, selected } = props;

  return (
    <span
      onClick={onClick}
      style={{
        fontSize: size,
        fontWeight: weight,
        color,
        cursor: onClick ? "pointer" : undefined,
        outline: selected ? "2px solid #22d3ee" : undefined,
        outlineOffset: selected ? 2 : undefined,
        ...style,
      }}
    >
      {value}
    </span>
  );
}
