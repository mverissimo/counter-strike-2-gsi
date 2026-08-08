import { Fragment, memo } from "react";

import type { SchemaMap } from "@counter-strike-2-gsi/types";

import styles from "./round-history.module.css";

type RoundWins = NonNullable<SchemaMap["round_wins"]>;

interface RoundHistoryProps {
  roundWins: RoundWins | undefined;
  /** Round after which the teams swap sides. MR12 is the current default. */
  halftime?: number;
}

function decode(result: string) {
  const team = result.startsWith("ct_") ? "CT" : "T";

  if (result.includes("bomb")) {
    return {
      team,
      how: "bomb",
    };
  }

  if (result.includes("defuse")) {
    return {
      team,
      how: "defuse",
    };
  }

  if (result.includes("time")) {
    return {
      team,
      how: "time",
    };
  }

  return {
    team,
    how: "elimination",
  };
}

function RoundHistoryImpl(props: RoundHistoryProps) {
  const { roundWins, halftime = 12 } = props;

  if (!roundWins) {
    return null;
  }

  // Keys are round numbers as strings; object key order is not something to
  // rely on, so sort numerically.
  const rounds = Object.keys(roundWins)
    .map(Number)
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);

  if (rounds.length === 0) {
    return null;
  }

  return (
    <div className={styles.root}>
      {rounds.map((round) => {
        const { team, how } = decode(roundWins[String(round)]);

        return (
          // `Fragment`, not a wrapper element: the pips have to be *direct*
          // children of the flex row. Nested inside a span they stay inline
          // boxes, and `inline-size`/`block-size` do not apply to those — the
          // whole strip collapses to a row of hairlines.
          <Fragment key={round}>
            {round === halftime + 1 && <span className={styles.break} />}
            <span
              className={styles.round}
              data-team={team}
              data-how={how}
              title={`Round ${round}: ${team} win by ${how}`}
            />
          </Fragment>
        );
      })}
    </div>
  );
}

/**
 * `round_wins` is a fresh object on every tick (state is merged immutably), so
 * the default shallow compare would re-render this 10 times a second for a
 * strip that only changes when a round ends.
 *
 * The map is append-only — a completed round's result is never rewritten — so
 * its size is a sound proxy for "has anything changed". Comparing size is O(1)
 * where comparing contents would be O(rounds).
 */
export const RoundHistory = memo(
  RoundHistoryImpl,
  (prev, next) =>
    prev.halftime === next.halftime &&
    Object.keys(prev.roundWins ?? {}).length === Object.keys(next.roundWins ?? {}).length,
);
