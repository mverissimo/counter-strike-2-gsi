import type { CSSProperties } from "react";

/**
 * Passes CSS custom properties through `style` without a cast at every call
 * site — React's `CSSProperties` still doesn't model `--*`.
 *
 * This is the seam the whole overlay is built on: React writes *numbers* into
 * custom properties and *states* into `data-` attributes, and the stylesheet
 * decides what those mean. A bar's width, colour and threshold behaviour stay
 * in CSS, so a value arriving at 10 Hz costs one style recalculation instead
 * of a re-render that rebuilds a class string.
 */
export function cssVars(vars: Record<string, string | number>): CSSProperties {
  return vars as CSSProperties;
}
