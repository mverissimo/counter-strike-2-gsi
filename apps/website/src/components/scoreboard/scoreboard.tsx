import { memo } from "react";

import { formatClock } from "../../lib/format.ts";
import styles from "./scoreboard.module.css";

interface ScoreboardProps {
  ctName: string;
  ctScore: number;
  tName: string;
  tScore: number;
  round: number;
  mapName: string;
  phase: string;
  /** Whole seconds left in the phase; floored by the caller. */
  phaseEndsIn: number | undefined;
}

const PHASE_LABEL: Record<string, string> = {
  freezetime: "freeze",
  live: "live",
  over: "round over",
  bomb: "bomb",
  defuse: "defusing",
  warmup: "warmup",
  timeout_t: "timeout",
  timeout_ct: "timeout",
};

/**
 * Every prop is a primitive already reduced to what is drawn, so the default
 * shallow compare on `memo` is enough: this re-renders when the score or the
 * clock second changes, not on every GSI tick. A prop carrying more precision
 * than the render uses would quietly undo that.
 */
export const Scoreboard = memo(function Scoreboard(props: ScoreboardProps) {
  const { ctName, ctScore, tName, tScore, round, mapName, phase, phaseEndsIn } = props;

  // On a floored value, `<= 9` is the last ten seconds shown: 0:09 to 0:00.
  const urgent = phase === "live" && phaseEndsIn !== undefined && phaseEndsIn <= 9;

  return (
    <div className={styles.root}>
      <div className={styles.bar}>
        <div className={styles.side} data-team="CT">
          <span className={styles.teamName}>{ctName}</span>
          <span className={styles.score}>{ctScore}</span>
        </div>

        <div className={styles.clock} data-phase={phase} data-urgent={urgent}>
          <span className={styles.time}>{formatClock(phaseEndsIn)}</span>
          <span className={styles.phase}>{PHASE_LABEL[phase] ?? phase}</span>
        </div>

        <div className={styles.side} data-side="right" data-team="T">
          <span className={styles.teamName}>{tName}</span>
          <span className={styles.score}>{tScore}</span>
        </div>
      </div>

      <div className={styles.meta}>
        <span>{mapName}</span>
        <span className={styles.dot} />
        <span>round {round}</span>
      </div>
    </div>
  );
});
