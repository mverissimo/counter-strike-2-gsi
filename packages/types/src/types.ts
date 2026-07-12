import type { Simplify } from "type-fest";

import type { SchemaPayload } from "./schema";
import type { LeafPaths } from "./utils";

export type { PathValue } from "./utils";

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
  "allplayers:joined": Delta<string[]>;
  "allplayers:left": Delta<string[]>;
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
