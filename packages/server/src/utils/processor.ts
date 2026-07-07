import isEqual from "fast-deep-equal";
import microdiff, { type Difference } from "microdiff";
import type {
  SchemaPayload,
  Block,
  EventMap,
  BlockEventName,
  GranularEventName,
} from "@counter-strike-2-gsi/types";
import type { Emitter } from "../lib/emitter";

/**
 * Event names that are not diff paths: they must not mark their `<block>:`
 * prefix as granular interest, or a lone "allplayers:joined" listener would
 * force a deep diff of the biggest block in state.
 */
const CUSTOM_EVENTS = new Set(["update", "error", "allplayers:joined", "allplayers:left"]);

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
   * The event name matches exactly what the type system generates from
   * `LeafPaths<SchemaPayload>`.
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

      for (const change of changes) {
        const eventName = `${block}:${change.path.join(":")}` as GranularEventName;

        emitter.emit(eventName, this.toDelta(change));
      }
    }

    this.joinLeft(previous, current, emitter);
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

    this.joinLeft(previous, current, emitter);
  }

  /**
   * High-level "allplayers:joined" / "allplayers:left" events based on
   * SteamID set differences. Runs regardless of change-detection mode.
   */
  public joinLeft(previous: SchemaPayload, current: SchemaPayload, emitter: Emitter<EventMap>) {
    const prevPlayers = previous.allplayers ?? {};
    const currPlayers = current.allplayers ?? {};

    const prevSteamIDs = new Set(Object.keys(prevPlayers));
    const currSteamIDs = new Set(Object.keys(currPlayers));

    const joined = [...currSteamIDs].filter((id) => !prevSteamIDs.has(id));
    const left = [...prevSteamIDs].filter((id) => !currSteamIDs.has(id));

    if (joined.length > 0) {
      emitter.emit("allplayers:joined", {
        previous: undefined,
        current: joined,
      });
    }

    if (left.length > 0) {
      emitter.emit("allplayers:left", {
        previous: undefined,
        current: left,
      });
    }
  }
}
