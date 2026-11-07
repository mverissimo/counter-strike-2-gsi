import { describe, expect, it } from "vitest";
import { parseKeyValues } from "../keyvalues";

describe("KeyValues syntax", () => {
  it.each(['"token" "unterminated', '"token" "valid" "', '"data" { "provider" "1" } "'])(
    "rejects incomplete quoted strings: %s",
    (source) => {
      expect(() => parseKeyValues(source)).toThrow("syntax");
    },
  );
  it("preserves escaped paths and quotes while consuming comments and whitespace", () => {
    expect(
      parseKeyValues(
        '\uFEFF// comment\r\n"root" { path "D:\\\\Steam" label "say \\"hi\\"" } // end',
      ),
    ).toEqual({ root: { path: "D:\\Steam", label: 'say "hi"' } });
  });
  it.each(['"root" {', "}", '"key"', '"key" }'])(
    "rejects incomplete entries and unmatched braces: %s",
    (source) => {
      expect(() => parseKeyValues(source)).toThrow();
    },
  );
});
