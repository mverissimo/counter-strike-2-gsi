import type { CSSProperties, MouseEventHandler, ReactNode } from "react";

export interface StackProps {
  direction?: "row" | "column";
  gap?: number;
  align?: CSSProperties["alignItems"];
  justify?: CSSProperties["justifyContent"];
  style?: CSSProperties;
  children?: ReactNode;
  onClick?: MouseEventHandler<HTMLDivElement>;
  selected?: boolean;
}

export function Stack(props: StackProps) {
  const { direction = "row", gap = 0, align, justify, style, children, onClick, selected } = props;

  return (
    <div
      onClick={onClick}
      style={{
        display: "flex",
        flexDirection: direction,
        gap,
        alignItems: align,
        justifyContent: justify,
        cursor: onClick ? "pointer" : undefined,
        outline: selected ? "2px solid #22d3ee" : undefined,
        outlineOffset: selected ? 2 : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
