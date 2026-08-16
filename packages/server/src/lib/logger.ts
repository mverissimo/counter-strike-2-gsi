/**
 * Sink for the things the manager has to say out loud: a payload that failed
 * validation, an update that threw, a listener that threw.
 *
 * Deliberately narrowed to `warn`/`error` — `console` satisfies it as-is, and
 * so does every structured logger worth injecting (pino, winston, a test spy)
 * without an adapter in between. A GSI process is usually a HUD backend with
 * its own log format; hardcoding `console` meant its output was the one thing
 * that couldn't join it.
 */
export interface GSILogger {
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

export const defaultLogger: GSILogger = console;

/**
 * Drops everything. For tests, and for hosts that report failures through the
 * `"error"` / `"validation"` events instead of a log.
 */
export const silentLogger: GSILogger = {
  warn() {},
  error() {},
};
