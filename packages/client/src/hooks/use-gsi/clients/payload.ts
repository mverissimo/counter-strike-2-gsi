import type { EventMap, EventPayload } from "@counter-strike-2-gsi/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseEventPayload(
  event: keyof EventMap,
  value: unknown,
): EventPayload<keyof EventMap> {
  if (!isRecord(value)) {
    throw new TypeError(`Invalid GSI payload for ${event}`);
  }

  if (event === "error" && isRecord(value.error)) {
    const remote = value.error;
    const error = new Error(
      typeof remote.message === "string" ? remote.message : "Remote GSI error",
    );

    if (typeof remote.name === "string") error.name = remote.name;
    if (typeof remote.stack === "string") error.stack = remote.stack;

    return { ...value, error } as EventPayload<"error">;
  }

  return value as EventPayload<keyof EventMap>;
}

export function parseEventFrame(value: unknown): {
  event: keyof EventMap;
  data: EventPayload<keyof EventMap>;
} {
  if (!isRecord(value) || typeof value.event !== "string" || !Object.hasOwn(value, "data")) {
    throw new TypeError("Invalid GSI event frame");
  }

  const event = value.event as keyof EventMap;

  return { event, data: parseEventPayload(event, value.data) };
}
