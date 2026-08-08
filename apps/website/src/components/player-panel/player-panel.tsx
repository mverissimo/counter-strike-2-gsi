import { memo } from "react";

import { healthState } from "../../lib/derive.ts";
import { formatMoney, formatWeapon } from "../../lib/format.ts";
import { StatBar } from "../stat-bar/stat-bar.tsx";
import styles from "./player-panel.module.css";

interface PlayerPanelProps {
  name: string;
  team: "CT" | "T" | undefined;
  health: number;
  armor: number;
  helmet: boolean;
  money: number;
  roundKills: number;
  hasDefuseKit: boolean;
  weaponName: string | undefined;
  ammoClip: number | undefined;
  ammoClipMax: number | undefined;
  ammoReserve: number | undefined;
}

/** The observed player — bottom-left, the classic HUD position. */
export const PlayerPanel = memo(function PlayerPanel(props: PlayerPanelProps) {
  const {
    name,
    team,
    health,
    armor,
    helmet,
    money,
    roundKills,
    hasDefuseKit,
    weaponName,
    ammoClip,
    ammoClipMax,
    ammoReserve,
  } = props;

  const state = healthState(health);
  const alive = health > 0;
  const lowAmmo =
    ammoClip !== undefined && ammoClipMax !== undefined && ammoClipMax > 0
      ? ammoClip / ammoClipMax <= 0.25
      : false;

  return (
    <section className={styles.root} data-team={team} data-alive={alive}>
      <header className={styles.header}>
        <span className={styles.name}>{name}</span>
        <span className={styles.money}>{formatMoney(money)}</span>
      </header>

      <div className={styles.vitals}>
        <span className={styles.label}>HP</span>
        <span className={styles.value} data-state={state}>
          {health}
        </span>
        <StatBar value={health} tone="health" state={state} />

        <span className={styles.label}>AP</span>
        <span className={styles.value}>{armor}</span>
        <StatBar value={armor} tone="armor" />
      </div>

      {weaponName && (
        <div className={styles.weapon}>
          <span className={styles.weaponName}>{formatWeapon(weaponName)}</span>
          <span className={styles.ammo} data-low={lowAmmo}>
            {ammoClip !== undefined && (
              <>
                <span className={styles.clip}>{ammoClip}</span>
                <span className={styles.reserve}> / {ammoReserve ?? 0}</span>
              </>
            )}
          </span>
        </div>
      )}

      <div className={styles.tags}>
        {helmet && <span className={styles.tag}>helmet</span>}
        {hasDefuseKit && <span className={styles.tag}>kit</span>}
        {roundKills > 0 && (
          <span className={styles.tag} data-kind="kills">
            {roundKills}k
          </span>
        )}
      </div>
    </section>
  );
});
