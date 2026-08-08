import { memo } from "react";

import { cssVars } from "../../lib/css.ts";
import type { HealthState } from "../../lib/derive.ts";
import styles from "./stat-bar.module.css";

interface StatBarProps {
  value: number;
  max?: number;
  tone: "health" | "armor" | "team";
  /** Drives the threshold styling in CSS; see `healthState()`. */
  state?: HealthState;
  height?: string;
}

/**
 * The overlay's only shared visual primitive. Everything else is bespoke —
 * which is the norm for a HUD, and the reason this app uses CSS Modules
 * rather than a utility framework.
 */
export const StatBar = memo(function StatBar(props: StatBarProps) {
  const { value, max = 100, tone, state, height } = props;

  const pct = max <= 0 ? 0 : Math.min(1, Math.max(0, value / max));

  return (
    <div
      className={styles.track}
      data-tone={tone}
      data-state={state}
      style={cssVars({
        "--pct": pct,
        ...(height ? { "--bar-height": height } : {}),
      })}
    >
      <div className={styles.fill} />
    </div>
  );
});
