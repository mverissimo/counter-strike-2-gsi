import isEqual from "fast-deep-equal";
import type { Difference } from "microdiff";
import type {
  SchemaPayload,
  Block,
  EventMap,
  BlockEventName,
  GranularEventName,
} from "@counter-strike-2-gsi/types";
import type { Emitter } from "../lib/emitter";

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
   * Granular mode: Emits block events once (deduplicated) + one granular
   * event per changed path. The event name matches exactly what the type
   * system generates from `LeafPaths<SchemaPayload>`.
   */
  public granular(
    previous: SchemaPayload,
    current: SchemaPayload,
    changes: Difference[],
    emitter: Emitter<EventMap>,
  ) {
    if (!changes.length) {
      return;
    }

    const emittedBlocks = new Set<Block>();

    for (const change of changes) {
      if (change.path.length === 0) {
        continue;
      }

      const block = change.path[0] as BlockEventName;

      if (!emittedBlocks.has(block)) {
        emittedBlocks.add(block);

        this.dispatch(block, previous, current, emitter);
      }

      if (change.path.length >= 2) {
        const eventName = change.path.join(":") as GranularEventName;

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
