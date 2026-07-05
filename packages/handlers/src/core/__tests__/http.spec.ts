import { describe, expect, it } from "vitest";

import { classifyHandlerError, safeTokenEqual } from "../http";

describe("classifyHandlerError", () => {
  it("classifies SyntaxError (malformed JSON) as 400", () => {
    let parseError: Error;

    try {
      JSON.parse("not json");

      throw new Error("unreachable");
    } catch (err) {
      parseError = err as Error;
    }

    expect(classifyHandlerError(parseError).status).toBe(400);
  });

  it.each([
    "GSI: Empty payload",
    "GSI: Invalid or empty payload",
    "GSI validation failed:\nsomething",
  ])("classifies %j as 400", (message) => {
    expect(classifyHandlerError(new Error(message)).status).toBe(400);
  });

  it("classifies unknown errors as 500", () => {
    expect(classifyHandlerError(new Error("database exploded")).status).toBe(500);
  });

  it("includes the error message outside production", () => {
    const { body } = classifyHandlerError(new Error("GSI: Empty payload"));

    expect(body.error).toBe("GSI: Empty payload");
  });
});

describe("safeTokenEqual", () => {
  it("accepts an exact match", () => {
    expect(safeTokenEqual("secret-token", "secret-token")).toBe(true);
  });

  it("rejects a mismatch", () => {
    expect(safeTokenEqual("secret-token", "secret-tokem")).toBe(false);
  });

  it("rejects different lengths, including prefixes", () => {
    expect(safeTokenEqual("secret-token", "secret")).toBe(false);
    expect(safeTokenEqual("secret", "secret-token")).toBe(false);
    expect(safeTokenEqual("secret", "")).toBe(false);
  });

  it("rejects non-string input", () => {
    expect(safeTokenEqual("secret", undefined)).toBe(false);
    expect(safeTokenEqual("secret", null)).toBe(false);
    expect(safeTokenEqual("secret", 42)).toBe(false);
  });
});
