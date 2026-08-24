import type { CSSProperties, MouseEventHandler } from "react";

export interface TextProps {
  value?: string | number;
  size?: number;
  weight?: CSSProperties["fontWeight"];
  color?: string;
  style?: CSSProperties;
  onClick?: MouseEventHandler<HTMLSpanElement>;
  selected?: boolean;
  [dataAttr: `data-${string}`]: unknown;
}

export function Text(props: TextProps) {
  const { value, size = 12, weight = 500, color, style, onClick, selected, ...dataAttrs } = props;

  return (
    <span
      onClick={onClick}
      data-part="text"
      {...dataAttrs}
      {...(selected ? { "data-selected": "" } : {})}
      style={{
        fontSize: size,
        fontWeight: weight,
        color,
        cursor: onClick ? "pointer" : undefined,
        ...style,
      }}
    >
      {value}
    </span>
  );
}
