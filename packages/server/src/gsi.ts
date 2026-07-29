import type { SchemaPayload, EventMap, EventPayload } from "@counter-strike-2-gsi/types";

import { createEmitter } from "./lib/emitter";
import { parsePayload } from "./utils/parser";
import { mergeDelta } from "./utils/merge";
import { Processor } from "./utils/processor";

export interface GSIOptions {
  /**
   * In strict mode, `update()` rethrows validation errors (after emitting
   * the `"error"` event) so transport handlers can answer with a 4xx.
   *
   * When false, a validation failure logs a warning and the payload is
   * salvaged rather than trusted wholesale: the top-level blocks that failed
   * are dropped and only the blocks that validated are merged into state. If
   * the payload root itself is invalid there is nothing to salvage and the
   * update is discarded entirely.
   * @default false
   */
  strictValidation?: boolean;

  /**
   * When false, skips arktype schema validation entirely. Payloads are still
   * JSON-parsed and sanitized (`auth`/`previously`/`added` stripped) before
   * merging, but their shape is trusted as-is and `strictValidation` has no
   * effect. Only safe when the source is the game itself on a local
   * interface — malformed data flows straight into state and events.
   * @default true
   */
  validatePayload?: boolean;

  /**
   * Controls change detection depth, event granularity, and performance trade-offs.
   *
   * - `'granular'` (default): Emits block-level events AND granular sub-path events
   *   (e.g. "player:state:health", "allplayers:7656119...:weapons:0:name").
   *   Provides rich `Delta` metadata. Ideal for interactive HUDs, overlays, and detailed analytics.
   *   Diffing is subscription-aware: only top-level blocks with a listener
   *   registered under them are deep-diffed, so the cost scales with what
   *   you actually subscribe to rather than with total state size.
   *
   * - `'block'`: Lightweight top-level block detection only (uses fast-deep-equal).
   *   Emits only broad block events (e.g. "player", "round", "allplayers") + custom join/left events.
   *   No granular events. Note: since granular diffing is subscription-aware,
   *   granular mode with few listeners is usually cheaper than block mode —
   *   pick 'block' for broad events, not for speed.
   *
   * - `'minimal'`: Ultra-lightweight mode. Only emits `"update"`, errors, and
   *   the allplayers:joined/left roster events. No block events, no granular events.
   *   Best for background monitoring, logging, or extremely constrained environments.
   *
   * The `"update"` event and `"allplayers:joined"`/`"allplayers:left"` are
   * emitted regardless of mode.
   *
   * @default 'granular'
   */
  changeDetection?: "block" | "granular" | "minimal";
}

export class GSI {
  private emitter = createEmitter<EventMap>();
  private current: SchemaPayload = {};
  private readonly processor = new Processor();
  private readonly options: GSIOptions;

  constructor(options: GSIOptions = {}) {
    this.options = {
      strictValidation: false,
      validatePayload: true,
      changeDetection: "granular",
      ...options,
    };
  }

  on<E extends keyof EventMap>(event: E, handler: (payload: EventPayload<E>) => void) {
    return this.emitter.on(event, handler);
  }

  off<E extends keyof EventMap>(event: E, handler?: (payload: EventPayload<E>) => void) {
    this.emitter.off(event, handler);
  }

  /**
   * Event names that currently have at least one listener. Mirrors what
   * granular mode reads to decide which blocks are worth deep-diffing, so
   * it's also the honest answer to "what is this instance actually paying
   * for?".
   */
  eventNames(): Array<keyof EventMap> {
    return this.emitter.eventNames();
  }

  /**
   * Number of listeners registered for `event`.
   */
  listenerCount<E extends keyof EventMap>(event: E): number {
    return this.emitter.listenerCount(event);
  }

  get state(): Readonly<SchemaPayload> {
    return this.current;
  }

  update(raw: unknown) {
    try {
      const cleanPayload = parsePayload(raw, {
        strictValidation: this.options.strictValidation,
        validatePayload: this.options.validatePayload,
      });

      const previous = this.current;

      // Skip mergeDelta's internal pre-diff: the processor detects changes
      // per block below, so diffing here would walk the state twice on the
      // 64 Hz hot path.
      const newState = mergeDelta(previous, cleanPayload, true);

      this.current = newState;

      if (newState !== previous) {
        this.emitChanges(previous, newState);
      }

      this.emitter.emit("update", this.current);
    } catch (err) {
      this.emitter.emit("error", {
        error: err as Error,
        context: "update",
      });

      if (this.options.strictValidation) {
        throw err;
      }

      console.error("[GSI] Update failed:", err);
    }
  }

  reset() {
    const previous = this.current;

    this.current = {};

    this.emitChanges(previous, this.current);

    this.emitter.emit("update", this.current);
  }

  /**
   * Routes a state transition to the processor for the configured
   * change-detection mode. `"allplayers:joined"`/`"allplayers:left"` are
   * emitted in every mode — `granular`/`block` fan them out themselves,
   * `minimal` gets them from `joinLeft` directly.
   */
  private emitChanges(previous: SchemaPayload, current: SchemaPayload) {
    const mode = this.options.changeDetection;

    if (mode === "granular") {
      this.processor.granular(previous, current, this.emitter);
    } else if (mode === "block") {
      this.processor.block(previous, current, this.emitter);
    } else {
      this.processor.joinLeft(previous, current, this.emitter);
    }
  }
}
