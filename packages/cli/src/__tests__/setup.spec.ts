import { mkdtemp, mkdir, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  components,
  filename,
  installConfig,
  parseComponents,
  readConfig,
  renderConfig,
} from "../config";
import { discoverGames, resolveGame } from "../discovery";
import { parseKeyValues } from "../keyvalues";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});
async function fixture() {
  const root = await realpath(await mkdtemp(join(tmpdir(), "cs2-gsi-")));
  roots.push(root);
  const game = join(root, "steamapps/common/Counter-Strike Global Offensive");
  const cfg = join(game, "game/csgo/cfg");
  await mkdir(cfg, { recursive: true });
  await writeFile(
    join(root, "steamapps/appmanifest_730.acf"),
    '"AppState" { "appid" "730" "installdir" "Counter-Strike Global Offensive" }',
  );
  return { root, game, cfg, path: join(cfg, filename) };
}

describe("Steam discovery", () => {
  it("continues after malformed manifests and reports each failure", async () => {
    const broken = await fixture();
    const healthy = await fixture();
    await writeFile(join(broken.root, "steamapps/libraryfolders.vdf"), '"unclosed');
    await writeFile(join(broken.root, "steamapps/appmanifest_730.acf"), '"unclosed');
    const warnings: string[] = [];
    expect(
      await discoverGames([broken.root, healthy.root], (message) => warnings.push(message)),
    ).toEqual([healthy.game]);
    expect(warnings).toHaveLength(2);
    expect(warnings[0]).toContain("libraryfolders.vdf");
    expect(warnings[1]).toContain("appmanifest_730.acf");
  });
  it("continues after an unreadable manifest entry", async () => {
    const broken = await fixture();
    const healthy = await fixture();
    const manifest = join(broken.root, "steamapps/appmanifest_730.acf");
    await rm(manifest);
    await mkdir(manifest);
    const warnings: string[] = [];
    expect(
      await discoverGames([broken.root, healthy.root], (message) => warnings.push(message)),
    ).toEqual([healthy.game]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("appmanifest_730.acf");
  });
  it("finds secondary libraries and deduplicates library entries", async () => {
    const first = await fixture();
    const second = await fixture();
    await writeFile(
      join(first.root, "steamapps/libraryfolders.vdf"),
      `"libraryfolders" { "0" { "path" ${JSON.stringify(first.root)} } "1" { "path" ${JSON.stringify(second.root)} } }`,
    );
    expect(await discoverGames([first.root])).toEqual([first.game, second.game]);
    await expect(resolveGame(undefined, first.root)).rejects.toThrow("Multiple");
    expect(await resolveGame(second.game)).toBe(second.game);
  });
  it("reads escaped Windows paths and old-style libraries", () => {
    expect(parseKeyValues('"libraryfolders" { "1" "D:\\\\SteamLibrary" }')).toEqual({
      libraryfolders: { "1": "D:\\SteamLibrary" },
    });
  });
  it("reports missing installations without creating a directory", async () => {
    const { root } = await fixture();
    await expect(resolveGame(undefined, join(root, "missing"))).rejects.toThrow("not found");
    await expect(installConfig(root, {})).rejects.toThrow();
  });
});

describe("managed configuration", () => {
  it("repairs an invalid endpoint while preserving token and components", async () => {
    const { game, path } = await fixture();
    await installConfig(game, { data: ["provider", "map"] });
    const original = await readConfig(path);
    const invalid = (await readFile(path, "utf8")).replace(":3000/gsi", ":0/gsi");
    await writeFile(path, invalid);
    await expect(readConfig(path)).rejects.toThrow("port");
    await expect(installConfig(game, {})).rejects.toThrow("port");
    expect(await readFile(path, "utf8")).toBe(invalid);
    await installConfig(game, { uri: "http://127.0.0.1:4000/gsi" });
    expect(await readConfig(path)).toEqual({ ...original, uri: "http://127.0.0.1:4000/gsi" });
  });
  it("accepts UTF-8 BOM with CRLF and preserves authentication on update", async () => {
    const { game, path } = await fixture();
    await installConfig(game, {});
    const original = await readConfig(path);
    await writeFile(path, "\uFEFF" + (await readFile(path, "utf8")).replaceAll("\n", "\r\n"));
    expect(await readConfig(path)).toEqual(original);
    await installConfig(game, {});
    expect(await readConfig(path)).toEqual(original);
  });
  it("does not overwrite malformed syntax even with explicit replacements", async () => {
    const { game, path } = await fixture();
    await installConfig(game, {});
    const invalid = (await readFile(path, "utf8")) + '"';
    await writeFile(path, invalid);
    await expect(installConfig(game, { uri: "http://127.0.0.1:4000/gsi" })).rejects.toThrow(
      "syntax",
    );
    expect(await readFile(path, "utf8")).toBe(invalid);
  });
  it("reads and updates CRLF configs without losing settings", async () => {
    const { game, path } = await fixture();
    await installConfig(game, { data: ["provider", "map"] });
    const original = await readConfig(path);
    await writeFile(path, (await readFile(path, "utf8")).replaceAll("\n", "\r\n"));
    expect(await readConfig(path)).toEqual(original);
    await installConfig(game, { uri: "http://127.0.0.1:4000/gsi" });
    expect(await readConfig(path)).toEqual({ ...original, uri: "http://127.0.0.1:4000/gsi" });
  });
  it("rejects port zero before creating or changing a config", async () => {
    const { game, path } = await fixture();
    await expect(installConfig(game, { uri: "http://127.0.0.1:0/gsi" })).rejects.toThrow("port");
    expect(await readConfig(path)).toBeUndefined();
    await installConfig(game, {});
    const original = await readFile(path, "utf8");
    await expect(installConfig(game, { uri: "http://127.0.0.1:00/gsi" })).rejects.toThrow("port");
    expect(await readFile(path, "utf8")).toBe(original);
  });
  it("rejects unknown components in an existing config instead of silently dropping them", async () => {
    const { game, path } = await fixture();
    await installConfig(game, {});
    await writeFile(
      path,
      (await readFile(path, "utf8")).replace('"provider" "1"', '"unknown" "1"'),
    );
    await expect(readConfig(path)).rejects.toThrow("components");
    expect(() => parseComponents([])).toThrow("components");
    expect(parseComponents(["provider", "map"])).toEqual(["provider", "map"]);
  });
  it("installs, preserves settings and token on rerun, and updates only its own file", async () => {
    const { game, path, cfg } = await fixture();
    const unrelated = join(cfg, "gamestate_integration_other.cfg");
    await writeFile(unrelated, "another tool");
    expect((await installConfig(game, {})).changed).toBe(true);
    const initial = await readConfig(path);
    expect(initial?.token).toMatch(/^[a-f0-9]{64}$/);
    expect(initial?.data).toEqual(components);
    expect((await installConfig(game, {})).changed).toBe(false);
    await installConfig(game, { uri: "http://127.0.0.1:4000/custom", data: ["provider", "map"] });
    expect(await readConfig(path)).toEqual({
      ...initial,
      uri: "http://127.0.0.1:4000/custom",
      data: ["provider", "map"],
    });
    expect((await installConfig(game, {})).changed).toBe(false);
    expect(await readFile(unrelated, "utf8")).toBe("another tool");
  });
  it("refuses unmanaged files and symlinks", async () => {
    const { game, path, cfg } = await fixture();
    await writeFile(path, "handwritten config");
    await expect(installConfig(game, {})).rejects.toThrow("not managed");
    expect(await readFile(path, "utf8")).toBe("handwritten config");
    await rm(path);
    const target = join(cfg, "target");
    await mkdir(target);
    const protectedFile = join(target, "keep.txt");
    await writeFile(protectedFile, "leave alone");
    await symlink(target, path, process.platform === "win32" ? "junction" : "dir");
    await expect(installConfig(game, {})).rejects.toThrow("non-regular");
    expect(await readFile(protectedFile, "utf8")).toBe("leave alone");
  });
  it("escapes tokens and rejects config injection or invalid options before writing", async () => {
    const { game, path } = await fixture();
    const token = 'a"b\\c';
    await installConfig(game, { token });
    expect((await readConfig(path))?.token).toBe(token);
    await expect(installConfig(game, { token: "bad\nvalue" })).rejects.toThrow("control");
    expect(() => parseComponents(["unknown"])).toThrow("components");
    await expect(installConfig(game, { uri: "file:///tmp/hello" })).rejects.toThrow("HTTP");
    expect((await readConfig(path))?.token).toBe(token);
    expect(() =>
      renderConfig({ uri: "http://localhost/gsi", token: "", data: ["provider"] }),
    ).toThrow("empty");
  });
});
