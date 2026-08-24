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
  [dataAttr: `data-${string}`]: unknown;
}

export function Stack(props: StackProps) {
  const {
    direction = "row",
    gap = 0,
    align,
    justify,
    style,
    children,
    onClick,
    selected,
    ...dataAttrs
  } = props;

  return (
    <div
      onClick={onClick}
      data-part="stack"
      {...dataAttrs}
      {...(selected ? { "data-selected": "" } : {})}
      style={{
        display: "flex",
        flexDirection: direction,
        gap,
        alignItems: align,
        justifyContent: justify,
        cursor: onClick ? "pointer" : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
