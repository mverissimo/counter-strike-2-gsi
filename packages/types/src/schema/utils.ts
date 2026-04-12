import { type } from "arktype";

export const stringToVector3 = type("string").pipe((input: string) => {
  if (!input || typeof input !== "string") {
    return null;
  }

  const parts = input
    .trim()
    .replace(/,/g, " ")
    .split(/\s+/)
    .map((p) => Number(p.trim()));

  if (parts.length !== 3 || parts.some(isNaN)) {
    console.warn(`[GSI] Failed to parse vector: "${input}"`);

    return null;
  }

  return {
    x: parts[0],
    y: parts[1],
    z: parts[2],
  };
});

export const stringToNumber = type("string").pipe((input: string) => {
  if (!input) {
    return null;
  }

  const num = Number(input.trim());

  return isNaN(num) ? null : num;
});

export const stringArrayToNumbers = type("string[]").pipe((arr) =>
  arr.map((s) => Number(s)).filter((n) => !isNaN(n)),
);
