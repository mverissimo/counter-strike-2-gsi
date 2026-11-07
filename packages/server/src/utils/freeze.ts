export function freezeSnapshot<T>(value: T, visited = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object" || visited.has(value)) {
    return value;
  }

  visited.add(value);

  for (const child of Object.values(value)) {
    freezeSnapshot(child, visited);
  }

  return Object.freeze(value);
}
