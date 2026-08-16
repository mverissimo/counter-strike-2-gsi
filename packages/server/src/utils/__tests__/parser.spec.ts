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

    it("non-strict (default): logs a warning and drops the invalid block", () => {
      const result = parsePayload(invalidPayload);

      expect(console.warn).toHaveBeenCalledOnce();
      expect(result).toEqual({});
    });

    it("non-strict (default): keeps the blocks that validated", () => {
      const mixed = {
        // `round` is valid on its own; `player.state` is not.
        round: { phase: "live" },
        player: { state: { health: 999 } },
      };

      const result = parsePayload(mixed);

      expect(result).toEqual({ round: { phase: "live" } });
    });

    it("non-strict (default): an invalid nested field only costs its own block", () => {
      const mixed = {
        ...payload,
        grenades: { "291": { lifetime: 4.242 } },
      } as unknown;

      const result = parsePayload(mixed) as Record<string, unknown>;

      expect(result).not.toHaveProperty("grenades");
      expect(result).toMatchObject({ player: { name: "s1mple" }, map: { name: "de_inferno" } });
    });

    it("non-strict (default): warning message contains the validation summary", () => {
      parsePayload(invalidPayload);

      const warnArgs = (console.warn as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(warnArgs[0]).toContain("[GSI]");
    });

    it("strict mode: throws with 'GSI validation failed'", () => {
      expect(() => parsePayload(invalidPayload, { strictValidation: true })).toThrow(
        "GSI validation failed",
      );
    });
  });

  describe("edge cases", () => {
    it("array input: rejected at the boundary instead of silently coerced to {}", () => {
      expect(() => parsePayload([])).toThrow("Payload must be a non-null object");
    });

    it("unknown/extra top-level fields are passed through without error", () => {
      const withExtra = { ...payload, _unknown: "should-survive" } as unknown;
      const result = parsePayload(withExtra) as Record<string, unknown>;

      expect(result["_unknown"]).toBe("should-survive");
    });

    it("strips auth, previously, and added so they never reach state", () => {
      const gsiStyle = {
        ...payload,
        auth: { token: "secret" },
        previously: { player: { state: { health: 90 } } },
        added: { bomb: true },
      } as unknown;

      const result = parsePayload(gsiStyle);

      expect(result).not.toHaveProperty("auth");
      expect(result).not.toHaveProperty("previously");
      expect(result).not.toHaveProperty("added");
      expect(result).toMatchObject({ player: { name: "s1mple" } });
    });

    it("strips allplayers.custom (CS2 roster bookkeeping) without touching the roster", () => {
      const gsiStyle = {
        ...payload,
        allplayers: {
          ...payload.allplayers,
          custom: { joined: ["76561198000000099"], left: [] },
        },
      } as unknown;

      const result = parsePayload(gsiStyle) as { allplayers?: Record<string, unknown> };

      expect(result.allplayers).not.toHaveProperty("custom");
      expect(result.allplayers).toHaveProperty("76561198000000001");
      expect(result.allplayers).toHaveProperty("76561198000000003");
    });

    it("does not mutate the input when stripping allplayers.custom", () => {
      const input = {
        allplayers: {
          custom: { joined: [], left: [] },
        },
      };

      parsePayload(input as unknown);

      expect(input.allplayers).toHaveProperty("custom");
    });

    it("leaves malformed primitive allplayers values alone when validation is disabled", () => {
      const result = parsePayload(
        {
          allplayers: "bad",
          map: { round: 7 },
        },
        { validatePayload: false },
      ) as unknown as Record<string, unknown>;

      expect(result).toEqual({
        allplayers: "bad",
        map: { round: 7 },
      });
    });

    it("strips previously/added even on the non-strict validation fallback path", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

      const invalid = {
        player: { state: { health: 999 } },
        previously: { player: { state: { health: 90 } } },
      } as unknown;

      const result = parsePayload(invalid);

      expect(result).not.toHaveProperty("previously");

      warn.mockRestore();
    });
  });

  describe("logger and validation callback", () => {
    beforeEach(() => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("routes the validation warning to the injected logger instead of console", () => {
      const logger = { warn: vi.fn() };

      parsePayload({ player: { state: { health: 999 } } }, { logger });

      expect(logger.warn).toHaveBeenCalledOnce();
      expect(console.warn).not.toHaveBeenCalled();
    });

    it("reports the dropped blocks through onValidationIssue", () => {
      const onValidationIssue = vi.fn();

      const result = parsePayload(
        {
          round: { phase: "live" },
          player: { state: { health: 999 } },
        },
        { onValidationIssue },
      );

      expect(onValidationIssue).toHaveBeenCalledOnce();
      expect(onValidationIssue).toHaveBeenCalledWith({
        summary: expect.any(String),
        dropped: ["player"],
        discarded: false,
      });
      expect(result).toEqual({ round: { phase: "live" } });
    });

    it("does not invoke onValidationIssue for valid payloads", () => {
      const onValidationIssue = vi.fn();

      parsePayload(payload, { onValidationIssue });

      expect(onValidationIssue).not.toHaveBeenCalled();
    });

    it("does not invoke onValidationIssue in strict mode (throws first)", () => {
      const onValidationIssue = vi.fn();

      expect(() =>
        parsePayload(
          { player: { state: { health: 999 } } },
          { strictValidation: true, onValidationIssue },
        ),
      ).toThrow("GSI validation failed");

      expect(onValidationIssue).not.toHaveBeenCalled();
    });
  });
});
