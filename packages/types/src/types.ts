import type { Simplify } from "type-fest";

import type { SchemaPayload } from "./schema";
import type { LeafPaths } from "./utils";

export type { PathValue } from "./utils";
export { MAX_PATH_DEPTH, FLATTENED_KEYS } from "./utils";

/**
 * Represents a state change between two game state payloads.
 *
 * @template T - The type of the value being tracked.
 *
 * @example
 * ```ts
 * const delta: Delta<number> = {
 *   previous: 100,
 *   current: 85,
 * };
 * ```
 */
export type Delta<T> = {
  previous?: T;
  current: T;
};

/** @internal Union of all path/type pairs derived from the schema. */
type AllPaths = LeafPaths<SchemaPayload>;

/**
 * A flat map of every auto-generated event name to its {@link Delta} payload.
 * Keys are colon-separated paths derived from {@link SchemaPayload}.
 *
 * @example
 * ```ts
 * type HealthDelta = GeneratedEventMap["player:health"];
 * // { previous?: number; current: number }
 *
 * type BombStateDelta = GeneratedEventMap["bomb:state"];
 * // { previous?: "planted" | "defused" | ...; current: "planted" | "defused" | ... }
 * ```
 */
export type GeneratedEventMap = Simplify<{
  [P in AllPaths as P["path"]]: Delta<P["type"]>;
}>;

/**
 * Complete event map including auto-generated schema events
 * and manually defined system events.
 *
 * @example
 * ```ts
 * emitter.on("update", (payload) => { ... });
 * emitter.on("error", ({ error, context }) => { ... });
 * emitter.on("player", ({ previous, current }) => { ... });
 * emitter.on("player:health", ({ previous, current }) => { ... });
 * emitter.on("allplayers:123:health", ({ previous, current }) => { ... });
 * ```
 */
export type EventMap = GeneratedEventMap & {
  update: SchemaPayload;
  error: {
    error: Error;
    context: string;
  };
  /**
   * Non-strict validation salvaged a payload: the blocks in `dropped` failed
   * the schema and were discarded, the rest merged normally. Fires only when
   * `validatePayload` is on and `strictValidation` is off (strict mode throws
   * and emits `"error"` instead).
   *
   * `discarded: true` means the payload *root* failed validation — nothing
   * was salvageable, `dropped` lists every block the payload carried, and
   * state was left completely untouched.
   */
  validation: {
    summary: string;
    dropped: string[];
    discarded: boolean;
  };
  "allplayers:joined": Delta<string[]>;
  "allplayers:left": Delta<string[]>;

  // Derived, HUD-oriented events the server computes from state transitions.
  // These are not diff paths: they fire on the transition itself, in every
  // change-detection mode, and never on a cold start (the first payload of a
  // match in progress reports state, not a transition).

  /** `round.phase` flipped to `"live"`. */
  "round:started": {
    /** `map.round` at the moment the round went live. */
    round?: number;
  };
  /** `round.phase` flipped to `"over"`. */
  "round:ended": {
    winner?: NonNullable<SchemaPayload["round"]>["win_team"];
    /** How the bomb factored into the outcome, when it did. */
    bomb?: NonNullable<SchemaPayload["round"]>["bomb"];
    round?: number;
  };
  /** `bomb.state` flipped to `"planted"`. */
  "bomb:planted": {
    /** SteamID of the planter, when CS2 reports it. */
    player?: string;
    countdown?: string;
  };
  /** `bomb.state` flipped to `"defused"`. */
  "bomb:defused": {
    /** SteamID of the defuser, when CS2 reports it. */
    player?: string;
  };
  /** `bomb.state` flipped to `"exploded"`. */
  "bomb:exploded": {
    position?: string;
  };
  /** The observed player's `state.health` hit 0. */
  "player:died": {
    steamid?: string;
    name?: string;
  };
  /** The observed player's `state.round_kills` went up. */
  "player:killed": {
    steamid?: string;
    name?: string;
    /** Kills gained in this tick (usually 1; >1 collapses simultaneous frags). */
    kills: number;
    /** Headshot kills gained in this tick. */
    headshots: number;
    /** Running `round_kills` total after the tick. */
    round_kills: number;
  };
};

/**
 * Extracts the payload type for a given event name.
 *
 * @template E - The event name.
 *
 * @example
 * ```ts
 * type P = EventPayload<"player:health">;
 * // { previous?: number; current: number }
 * ```
 */
export type EventPayload<E extends keyof EventMap> = EventMap[E];

/**
 * Top-level keys of the schema (e.g. `"player"`, `"map"`, `"bomb"`).
 */
export type Block = keyof SchemaPayload;

/**
 * Event names that correspond to top-level schema blocks.
 *
 * @example
 * ```ts
 * // "player" | "map" | "bomb" | "round" | ...
 * ```
 */
export type BlockEventName = Extract<keyof GeneratedEventMap, Block>;

/**
 * Event names that target nested properties within a block.
 *
 * @example
 * ```ts
 * // "player:health" | "player:team" | "bomb:state" | ...
 * ```
 */
export type GranularEventName = Exclude<keyof GeneratedEventMap, Block>;
