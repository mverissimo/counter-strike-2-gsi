import isEqual from "fast-deep-equal";
import microdiff, { type Difference } from "microdiff";
import { MAX_PATH_DEPTH, FLATTENED_KEYS } from "@counter-strike-2-gsi/types";
import type {
  SchemaPayload,
  Block,
  EventMap,
  BlockEventName,
  GranularEventName,
} from "@counter-strike-2-gsi/types";
import type { Emitter } from "../lib/emitter";
import { deriveEvents } from "./derived";

/**
 * Event names that are not diff paths: they must not mark their `<block>:`
 * prefix as granular interest, or a lone "allplayers:joined" listener would
 * force a deep diff of the biggest block in state. The derived events all
 * share a block prefix with a real schema block ("round:ended", "bomb:*",
 * "player:*"), so they need to be listed here too, or a HUD that *only*
 * listens for "round:ended" would silently pay for a full granular diff of
 * `round` on every tick.
 */
const CUSTOM_EVENTS = new Set([
  "update",
  "error",
  "validation",
  "allplayers:joined",
  "allplayers:left",
  "round:started",
  "round:ended",
  "bomb:planted",
  "bomb:defused",
  "bomb:exploded",
  "player:died",
  "player:killed",
]);

const FLATTENED = new Set<string>(FLATTENED_KEYS);

/**
 * Segments a granular event name may spend below its block. `LeafPaths` caps
 * a full event name at `MAX_PATH_DEPTH` segments and the block eats the first.
 */
const MAX_GRANULAR_SEGMENTS = MAX_PATH_DEPTH - 1;

export class Processor {
  private dispatch(
    block: BlockEventName,
    previous: SchemaPayload,
    current: SchemaPayload,
    emitter: Emitter<EventMap>,
  ) {
    emitter.emit(block, {
      previous: previous[block],
      current: current[block],
    } as EventMap[BlockEventName]);
  }

  /**
   * Rewrites a microdiff path into the segments the type system can actually
   * name, or `null` when the change has no generated event at all.
   *
   * A raw diff path and `LeafPaths<SchemaPayload>` disagree in three places,
   * and every one of them used to reach `emitter.emit` as a string that no
   * consumer could subscribe to with types on:
   *
   * - **Flattened keys.** `LeafPaths` traverses *through* `custom` without
   *   spending a segment, so `allplayers.custom.joined` has no name of its
   *   own — the declared name is `"allplayers:joined"`. Those changes are
   *   exactly the roster churn {@link derived} already reports, computed from
   *   the SteamID sets rather than read out of the payload, so they are
   *   dropped here rather than renamed: renaming would emit the same concept
   *   twice per update. Scoped to the *first* segment only — the one
   *   position `custom` is actually declared at in the schema (directly
   *   under `allplayers`) — rather than matching the key name at any depth.
   *   A `"custom"` key elsewhere in the tree (only reachable with
   *   `validatePayload: false`, since the schema declares no other one) is
   *   unrelated bookkeeping-shaped-by-coincidence, not roster churn, and
   *   dropping *its* diff wholesale would silently swallow an unrelated
   *   change for no reason.
   * - **Array indices.** `LeafPaths` stops at arrays, so `joined.0` is not a
   *   path but `joined` is. microdiff reports array indices as numbers and
   *   object keys as strings, which is how the two are told apart.
   * - **Depth.** `LeafPaths` stops at {@link MAX_PATH_DEPTH} segments. Deeper
   *   paths are reachable at runtime — CS2 adding nesting, or
   *   `validatePayload: false` letting an arbitrary shape through — but have
   *   no generated name.
   *
   * The last two truncate to the deepest expressible ancestor instead of
   * dropping the change, so a subscriber still hears that something under
   * their path moved. Truncation is also the only way two changes can land on
   * one name, which is why the caller dedupes exactly then and not otherwise.
   */
  private canonicalPath(path: Difference["path"]): string[] | null {
    const segments: string[] = [];

    for (const segment of path) {
      if (typeof segment === "number") {
        break;
      }

      if (segments.length === 0 && FLATTENED.has(segment)) {
        return null;
      }

      segments.push(segment);

      if (segments.length === MAX_GRANULAR_SEGMENTS) {
        break;
      }
    }

    // Nothing left to name: the block itself is the change, and the block
    // event has already been dispatched for it.
    return segments.length > 0 ? segments : null;
  }

  /** Reads the value a truncated path points at, for either side of the diff. */
  private readPath(root: unknown, segments: string[]): unknown {
    let node = root;

    for (const segment of segments) {
      if (node === null || typeof node !== "object") {
        return undefined;
      }

      node = (node as Record<string, unknown>)[segment];
    }

    return node;
  }

  private toDelta(change: Difference) {
    switch (change.type) {
      case "CREATE":
        return {
          previous: undefined,
          current: change.value,
        };

      case "REMOVE":
        return {
          previous: change.oldValue,
          current: undefined,
        };

      case "CHANGE":
        return {
          previous: change.oldValue,
          current: change.value,
        };

      default:
        return {
          previous: undefined,
          current: undefined,
        };
    }
  }

  /**
   * Granular mode: emits block events + one granular event per changed path.
   * Every emitted name is one the type system generates from
   * `LeafPaths<SchemaPayload>` — raw microdiff paths are run through
   * {@link canonicalPath} first, which is where the two used to drift apart.
   *
   * Diffing is subscription-aware: microdiff (the dominant cost of granular
   * mode) only runs on top-level blocks that have a listener registered
   * under them; blocks with only a block-level listener get a cheap
   * deep-equal check, and unsubscribed blocks are skipped entirely. State
   * merging is unaffected — this only skips computing deltas nobody
   * receives. Listeners are re-read on every update, so subscribing between
   * updates takes effect on the next one.
   *
   * A block that appears or disappears wholesale short-circuits to a block
   * event without granular sub-events, mirroring how a whole-tree microdiff
   * reports a single CREATE/REMOVE at the block root.
   */
  public granular(previous: SchemaPayload, current: SchemaPayload, emitter: Emitter<EventMap>) {
    const granularBlocks = new Set<string>();
    const blockListeners = new Set<string>();

    for (const name of emitter.eventNames() as string[]) {
      if (CUSTOM_EVENTS.has(name)) {
        continue;
      }

      const sep = name.indexOf(":");

      if (sep === -1) {
        blockListeners.add(name);
      } else {
        granularBlocks.add(name.slice(0, sep));
      }
    }

    const blocks = new Set<Block>([
      ...(Object.keys(previous) as Block[]),
      ...(Object.keys(current) as Block[]),
    ]);

    for (const block of blocks) {
      const prevBlock = previous[block];
      const currBlock = current[block];

      if (prevBlock === currBlock) {
        continue;
      }

      const wantsGranular = granularBlocks.has(block);

      if (!wantsGranular && !blockListeners.has(block)) {
        continue;
      }

      if (prevBlock === undefined || currBlock === undefined) {
        this.dispatch(block, previous, current, emitter);

        continue;
      }

      if (!wantsGranular) {
        if (!isEqual(prevBlock, currBlock)) {
          this.dispatch(block, previous, current, emitter);
        }

        continue;
      }

      const changes = microdiff(prevBlock as object, currBlock as object, {
        cyclesFix: false,
      });

      if (changes.length === 0) {
        continue;
      }

      this.dispatch(block, previous, current, emitter);

      // microdiff never reports one path twice, so names only collide once
      // canonicalisation has truncated something. The set is allocated on
      // that first truncation and skipped entirely on the common path.
      let emitted: Set<string> | undefined;

      for (const change of changes) {
        const segments = this.canonicalPath(change.path);

        if (!segments) {
          continue;
        }

        const eventName = `${block}:${segments.join(":")}` as GranularEventName;
        const truncated = segments.length !== change.path.length;

        if (truncated) {
          emitted ??= new Set();

          if (emitted.has(eventName)) {
            continue;
          }

          emitted.add(eventName);
        }

        emitter.emit(
          eventName,
          truncated
            ? {
                previous: this.readPath(prevBlock, segments),
                current: this.readPath(currBlock, segments),
              }
            : this.toDelta(change),
        );
      }
    }

    this.derived(previous, current, emitter);
  }

  /**
   * Block mode: Only top-level block events when content actually differs.
   * Uses fast-deep-equal to handle new object references from mergeDelta.
   */
  public block(previous: SchemaPayload, current: SchemaPayload, emitter: Emitter<EventMap>) {
    const allBlocks = new Set<Block>([
      ...(Object.keys(previous) as Block[]),
      ...(Object.keys(current) as Block[]),
    ]);

    for (const block of allBlocks) {
      if (!isEqual(previous[block], current[block])) {
        this.dispatch(block, previous, current, emitter);
      }
    }

    this.derived(previous, current, emitter);
  }

  /**
   * High-level, HUD-oriented events computed from the state transition —
   * roster churn (`"allplayers:joined"`/`"allplayers:left"`) and match
   * milestones (`"round:ended"`, `"bomb:planted"`, `"player:killed"`, …).
   * Runs regardless of change-detection mode; see {@link deriveEvents} for
   * the transition rules and their edge cases.
   */
  public derived(previous: SchemaPayload, current: SchemaPayload, emitter: Emitter<EventMap>) {
    for (const { event, payload } of deriveEvents(previous, current)) {
      emitter.emit(event, payload);
    }
  }
}
