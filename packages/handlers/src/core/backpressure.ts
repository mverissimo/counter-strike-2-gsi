export interface BackpressureInfo {
  clientId: string;
  pending: number;
  dropped: number;
}

export interface BackpressureQueueOptions {
  clientId: string;
  /** 0 disables the cap — writes queue without bound. */
  maxPendingWrites: number;
  logger: (message: string) => void;
  onBackpressure?: (info: BackpressureInfo) => void;
  /** Log-message label, e.g. `"SSE"` or `"WS"`. */
  label: string;
  /** Unit noun for log messages, e.g. `"writes"` or `"frames"`. */
  unit: string;
}

/**
 * Bounds a single connection's serialized write chain so a writer slower
 * than the event source — a throttled client, a stalled proxy, a paused tab
 * — can't retain an unbounded backlog of unsent payloads for the life of the
 * connection.
 *
 * Shared between the SSE and WS cores: same problem (writes are chained onto
 * a promise so an async writer can't interleave or drop events under 64 Hz
 * load, and that chain needs a ceiling), same trade-off (dropping is safe
 * here because every message either carries the full state or is
 * superseded by the next one) — just a different unit of "message" and a
 * different write-error signature per transport, both left to the caller.
 *
 * Past `maxPendingWrites` queued writes, further `enqueue` calls are
 * dropped: reported once per saturation episode via `logger`, and on every
 * drop via `onBackpressure`. Recovery is reported once too, when the queue
 * fully drains, so sustained backpressure doesn't spam either channel.
 */
export function createBackpressureQueue(options: BackpressureQueueOptions) {
  const { clientId, maxPendingWrites, logger, onBackpressure, label, unit } = options;

  let writeChain: Promise<void> = Promise.resolve();
  let pending = 0;
  let dropped = 0;
  let saturated = false;
  let closed = false;

  function enqueue(fn: () => void | Promise<void>, onError: (err: unknown) => void): Promise<void> {
    if (maxPendingWrites > 0 && pending >= maxPendingWrites) {
      dropped++;

      if (!saturated) {
        saturated = true;

        logger(
          `[${label}] Backpressure on ${clientId}: ${pending} ${unit} queued, dropping until drained`,
        );
      }

      onBackpressure?.({ clientId, pending, dropped });

      return writeChain;
    }

    if (saturated && pending === 0) {
      saturated = false;

      logger(`[${label}] Backpressure cleared on ${clientId} after dropping ${dropped} ${unit}`);
    }

    pending++;

    writeChain = writeChain.then(async () => {
      try {
        if (closed) {
          return;
        }

        await fn();
      } catch (err) {
        onError(err);
      } finally {
        pending--;
      }
    });

    return writeChain;
  }

  /** Stops the chain from running any further already-queued `fn`s once the connection closes. */
  function close() {
    closed = true;
  }

  return { enqueue, close };
}
