/**
 * The one match every mock describes — ported from `mock-roster.ts` on
 * `feat/website-overlay-and-derive`, trimmed of the `photo`/`logo` fields:
 * our catalog's `Avatar` primitive renders an initial + color, it doesn't
 * load images yet, so branding assets aren't wired up here.
 *
 * The steamids are written out rather than generated from a base id on
 * purpose — see the upstream file's note: they're a join key other config
 * could key off later, and an arithmetic slip here would be silent.
 */

export const MOCK_MAP = "de_mirage";

/** Invented orgs, matching the players' systems-programming-jargon nicknames. */
export const MOCK_TEAMS: Record<"CT" | "T", { name: string }> = {
  CT: { name: "Kernel Panic" },
  T: { name: "Heap Overflow" },
};

export interface MockPlayerSeed {
  steamid: string;
  name: string;
  team: "CT" | "T";
  slot: number;
}

export const MOCK_ROSTER: MockPlayerSeed[] = (
  [
    ["76561197960265730", "dev_null", "CT", 0],
    ["76561197960265731", "segfault", "CT", 1],
    ["76561197960265732", "nullptr", "CT", 2],
    ["76561197960265733", "kernel", "CT", 3],
    ["76561197960265734", "mutex", "CT", 4],
    ["76561197960265735", "heap", "T", 0],
    ["76561197960265736", "stack", "T", 1],
    ["76561197960265737", "raii", "T", 2],
    ["76561197960265738", "borrow", "T", 3],
    ["76561197960265739", "unsafe", "T", 4],
  ] as const
).map(([steamid, name, team, slot]) => ({ steamid, name, team, slot }));

/** The observed player in both mocks — first CT, so a card is highlighted. */
export const MOCK_OBSERVED = MOCK_ROSTER[0]!;
