import microdiff from "microdiff";
import type { SchemaPayload, EventMap, EventPayload } from "@counter-strike-2-gsi/types";

import { createEmitter } from "./lib/emitter";
import { parsePayload } from "./utils/parser";
import { mergeDelta } from "./utils/merge";
import { Processor } from "./utils/processor";

export interface GSIOptions {
  /**
   * In strict mode, `update()` rethrows validation errors (after emitting
   * the `"error"` event) so transport handlers can answer with a 4xx.
   * When false, invalid payloads log a warning and are applied as-is.
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
   * - `'granular'` (default): Runs microdiff + emits block-level events AND granular sub-path events
   *   (e.g. "player:state:health", "allplayers:7656119...:weapons:0:name").
   *   Provides rich `Delta` metadata. Ideal for interactive HUDs, overlays, and detailed analytics.
   *
   * - `'block'`: Lightweight top-level block detection only (uses fast-deep-equal).
   *   Emits only broad block events (e.g. "player", "round", "allplayers") + custom join/left events.
   *   No granular events, reduced CPU/GC pressure. Recommended for most production HUDs at ~64Hz.
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
      const mode = this.options.changeDetection;

      // Skip mergeDelta's internal pre-diff: granular mode diffs
      // previous vs merged below, so diffing here would run microdiff
      // twice per update on the 64 Hz hot path.
      const newState = mergeDelta(previous, cleanPayload, true);

      this.current = newState;

      if (newState !== previous) {
        if (mode === "granular") {
          const changes = microdiff(previous, newState, {
            cyclesFix: false,
          });

          if (changes.length > 0) {
            this.processor.granular(previous, newState, changes, this.emitter);
          }
        } else if (mode === "block") {
          this.processor.block(previous, newState, this.emitter);
        } else {
          this.processor.joinLeft(previous, newState, this.emitter);
        }
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

    const mode = this.options.changeDetection;

    if (mode === "block") {
      this.processor.block(previous, this.current, this.emitter);
    } else if (mode === "granular") {
      const changes = microdiff(previous, this.current, {
        cyclesFix: false,
      });

      if (changes.length > 0) {
        this.processor.granular(previous, this.current, changes, this.emitter);
      }
    } else {
      this.processor.joinLeft(previous, this.current, this.emitter);
    }

    this.emitter.emit("update", this.current);
  }
}
