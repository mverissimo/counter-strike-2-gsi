import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { parsePayload } from "../../utils/parser";
import { payload } from "../../../tests/fixtures";

describe("@server/utils/: parsePayload", () => {
  describe("valid inputs", () => {
    it("accepts a valid JSON string and returns the parsed payload", () => {
      const json = JSON.stringify(payload);
      const result = parsePayload(json);

      expect(result).toMatchObject({
        player: {
          name: "s1mple",
        },
      });
      expect(result).toMatchObject({
        map: {
          name: "de_inferno",
        },
      });
    });

    it("accepts a plain object and returns the validated payload", () => {
      const result = parsePayload(payload);

      expect(result).toMatchObject({
        player: {
          name: "s1mple",
        },
      });
    });

    it("accepts a partial payload (only some blocks present — GSI delta-style)", () => {
      const partial = {
        player: {
          name: "s1mple",
          state: {
            health: 100,
            armor: 100,
            helmet: true,
            flashed: 0,
            smoked: 0,
            burning: 0,
            money: 0,
            round_kills: 0,
            round_killhs: 0,
            equip_value: 0,
          },
        },
      };
      const result = parsePayload(partial);

      expect(result).toMatchObject({
        player: {
          name: "s1mple",
        },
      });
      expect(result).not.toHaveProperty("map");
      expect(result).not.toHaveProperty("round");
    });

    it("accepts an empty object (all schema fields are optional)", () => {
      const result = parsePayload({});

      expect(result).toEqual({});
    });
  });

  describe("invalid JSON string", () => {
    it("throws with 'GSI parser: Invalid JSON payload' when the string is malformed JSON", () => {
      expect(() => parsePayload("{broken json")).toThrow("GSI parser: Invalid JSON payload");
    });

    it("throws when the JSON string parses to null (second guard)", () => {
      expect(() => parsePayload("null")).toThrow(
        "GSI parser: Payload must be a non-null object after parsing",
      );
    });
  });

  describe("invalid input types", () => {
    it("throws when input is null", () => {
      expect(() => parsePayload(null)).toThrow("GSI parser: Input must be a string");
    });

    it("throws when input is undefined", () => {
      expect(() => parsePayload(undefined)).toThrow("GSI parser: Input must be a string");
    });

    it("throws when input is a number", () => {
      expect(() => parsePayload(42)).toThrow("GSI parser: Input must be a string");
    });

    it("throws when input is a boolean", () => {
      expect(() => parsePayload(true)).toThrow("GSI parser: Input must be a string");
    });
  });

  describe("schema validation failure", () => {
    const invalidPayload = {
      player: {
        state: {
          health: 999,
        },
      },
    };

    beforeEach(() => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("non-strict (default): logs a warning and returns the raw object", () => {
      const result = parsePayload(invalidPayload);

      expect(console.warn).toHaveBeenCalledOnce();
      expect(result).toBe(invalidPayload);
    });

    it("non-strict (default): warning message contains the validation summary", () => {
      parsePayload(invalidPayload);

      const warnArgs = (console.warn as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(warnArgs[0]).toContain("[GSIManager]");
    });

    it("strict mode: throws with 'GSI validation failed'", () => {
      expect(() => parsePayload(invalidPayload, { strictValidation: true })).toThrow(
        "GSI validation failed",
      );
    });
  });

  describe("edge cases", () => {
    it("array input: spread to {} before validation so it passes silently and returns empty payload", () => {
      // The parser does `{ ...rawPayload }` before calling schema.payload().
      // Spreading an array (e.g. []) into an object yields {}, which satisfies
      // the schema (all fields are optional). No warning is emitted; the validated
      // empty object is returned — not the original array.
      const result = parsePayload([]);

      expect(result).toEqual({});
    });

    it("unknown/extra top-level fields are passed through without error", () => {
      const withExtra = { ...payload, _unknown: "should-survive" } as unknown;
      const result = parsePayload(withExtra) as Record<string, unknown>;

      expect(result["_unknown"]).toBe("should-survive");
    });
  });
});
