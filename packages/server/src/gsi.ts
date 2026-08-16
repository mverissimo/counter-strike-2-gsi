import isEqual from "fast-deep-equal";

import type { SchemaPayload, EventMap, EventPayload } from "@counter-strike-2-gsi/types";

import { createEmitter, type Emitter } from "./lib/emitter";
import { defaultLogger, type GSILogger } from "./lib/logger";
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
   * - `'minimal'`: Ultra-lightweight mode. Only emits `"update"`, errors, the
   *   allplayers:joined/left roster events, and the derived events below.
   *   No block events, no granular events. Best for background monitoring,
   *   logging, or extremely constrained environments.
   *
   * The `"update"` event, `"allplayers:joined"`/`"allplayers:left"`, and the
   * derived events (`"round:started"`, `"round:ended"`, `"bomb:planted"`,
   * `"bomb:defused"`, `"bomb:exploded"`, `"player:died"`, `"player:killed"`)
   * are emitted regardless of mode — see `deriveEvents` in
   * `utils/derived.ts` for exactly what triggers each one.
   *
   * @default 'granular'
   */
  changeDetection?: "block" | "granular" | "minimal";

  /**
   * Where the manager's own diagnostics go: validation warnings in non-strict
   * mode, failed updates, and listener exceptions. Defaults to `console`;
   * inject your own to route them into structured logging or to silence them.
   * @default console
   */
  logger?: GSILogger;

  /**
   * CS2 posts at up to 64 Hz even when nothing changed, and by default every
   * accepted payload emits `"update"` — heartbeats included.
   *
   * Set to `false` to emit `"update"` only when the merged state actually
   * differs from the previous one. Costs one deep-equal walk of the state per
   * update — cheaper alternatives that pre-diff the incoming payload against
   * the full state before merging are unsound here, since GSI payloads are
   * routinely partial and a block absent from one tick is not a removal —
   * and also skips the (empty) change-detection pass on no-ops, so
   * downstream fan-out (SSE/WS) goes quiet between real changes.
   *
   * `reset()` always emits `"update"` — it is user-initiated, not a heartbeat.
   * @default true
   */
  emitUpdateOnNoop?: boolean;
}

export class GSI {
  private emitter: Emitter<EventMap>;
  private current: SchemaPayload = {};
  private readonly processor = new Processor();
  private readonly options: Required<Omit<GSIOptions, "logger">>;
  private readonly logger: GSILogger;

  constructor(options: GSIOptions = {}) {
    this.logger = options.logger ?? defaultLogger;
    this.emitter = createEmitter<EventMap>(this.logger);

    // Resolved key by key rather than spread over defaults so an explicit
    // `undefined` reads as "not provided" instead of erasing the default.
    this.options = {
      strictValidation: options.strictValidation ?? false,
      validatePayload: options.validatePayload ?? true,
      changeDetection: options.changeDetection ?? "granular",
      emitUpdateOnNoop: options.emitUpdateOnNoop ?? true,
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
        logger: this.logger,
        onValidationIssue: (issue) => {
          this.emitter.emit("validation", issue);
        },
      });

      const previous = this.current;

      // Always skip mergeDelta's own pre-diff here: it walks `delta` against
      // the *full* current state, so any top-level block genuinely absent
      // from a partial payload — which is the normal shape of GSI traffic,
      // not the exception — reads as a REMOVE and makes every partial
      // update look like a change. Safe only for full-snapshot deltas, which
      // GSI payloads generally aren't. The processor below detects changes
      // per block on its own, so this would also just walk the state twice
      // on the 64 Hz hot path even where it is safe.
      const newState = mergeDelta(previous, cleanPayload, true);

      // With the pre-diff skipped, an identical payload still yields a fresh
      // object (deepmerge allocates new objects along every touched path
      // regardless of whether the values differ), so reference inequality
      // alone can't prove a real change. Only when no-op suppression is on
      // is the deep-equal walk worth paying for.
      const changed =
        newState !== previous && (this.options.emitUpdateOnNoop || !isEqual(previous, newState));

      this.current = changed ? newState : previous;

      if (changed) {
        this.emitChanges(previous, this.current);
      }

      if (changed || this.options.emitUpdateOnNoop) {
        this.emitter.emit("update", this.current);
      }
    } catch (err) {
      this.emitter.emit("error", {
        error: err as Error,
        context: "update",
      });

      if (this.options.strictValidation) {
        throw err;
      }

      this.logger.error("[GSI] Update failed:", err);
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
   * change-detection mode. The derived events — roster churn
   * (`"allplayers:joined"`/`"allplayers:left"`) and match milestones
   * (`"round:ended"`, `"bomb:planted"`, `"player:killed"`, …) — are emitted
   * in every mode: `granular`/`block` fan them out themselves, `minimal`
   * gets them from `derived` directly.
   */
  private emitChanges(previous: SchemaPayload, current: SchemaPayload) {
    const mode = this.options.changeDetection;

    if (mode === "granular") {
      this.processor.granular(previous, current, this.emitter);
    } else if (mode === "block") {
      this.processor.block(previous, current, this.emitter);
    } else {
      this.processor.derived(previous, current, this.emitter);
    }
  }
}
