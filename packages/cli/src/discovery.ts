import { execFile } from "node:child_process";
import { readFile, realpath, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { promisify } from "node:util";
import { asObject, parseKeyValues } from "./keyvalues";

export async function defaultSteamRoots(): Promise<string[]> {
  if (process.platform === "win32") {
    const roots = [join(process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)", "Steam")];
    try {
      const { stdout } = await promisify(execFile)("reg.exe", [
        "query",
        "HKCU\\Software\\Valve\\Steam",
        "/v",
        "SteamPath",
      ]);
      const location = /SteamPath\s+REG_SZ\s+(.+)/i.exec(stdout)?.[1]?.trim();
      if (location) roots.unshift(location);
    } catch {
      /* Fall back to the standard install location or --steam-path. */
    }
    return roots;
  }
  return [
    join(homedir(), ".steam/steam"),
    join(homedir(), ".local/share/Steam"),
    join(homedir(), ".var/app/com.valvesoftware.Steam/.local/share/Steam"),
  ];
}

export async function configDirectory(gamePath: string): Promise<string> {
  const directory = join(resolve(gamePath), "game", "csgo", "cfg");
  if (!(await stat(directory)).isDirectory())
    throw new Error(`Not a CS2 config directory: ${directory}`);
  return realpath(directory);
}

export async function discoverGames(
  steamRoots: string[],
  onWarning: (message: string) => void = (message) => console.warn(message),
): Promise<string[]> {
  function report(path: string, error: unknown): void {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return;
    const reason = error instanceof Error ? error.message : String(error);
    onWarning(`Could not inspect ${path}: ${reason}`);
  }
  const libraries = new Set(steamRoots.map((root) => resolve(root)));
  for (const root of steamRoots) {
    try {
      const manifest = parseKeyValues(
        await readFile(join(root, "steamapps", "libraryfolders.vdf"), "utf8"),
      );
      for (const [key, entry] of Object.entries(asObject(manifest.libraryfolders))) {
        if (!/^\d+$/.test(key)) continue;
        const path = typeof entry === "string" ? entry : entry.path;
        if (typeof path === "string" && isAbsolute(path)) libraries.add(path);
      }
    } catch (error) {
      report(join(root, "steamapps", "libraryfolders.vdf"), error);
    }
  }
  const games = new Set<string>();
  for (const library of libraries) {
    try {
      const manifest = parseKeyValues(
        await readFile(join(library, "steamapps", "appmanifest_730.acf"), "utf8"),
      );
      const app = asObject(manifest.AppState);
      const name = app.installdir;
      if (
        app.appid !== "730" ||
        typeof name !== "string" ||
        /[/\\]/.test(name) ||
        name === ".." ||
        name === "."
      )
        continue;
      const game = join(library, "steamapps", "common", name);
      await configDirectory(game);
      games.add(await realpath(game));
    } catch (error) {
      report(join(library, "steamapps", "appmanifest_730.acf"), error);
    }
  }
  return [...games];
}

export async function resolveGame(gamePath?: string, steamPath?: string): Promise<string> {
  if (gamePath) {
    await configDirectory(gamePath);
    return resolve(gamePath);
  }
  const games = await discoverGames(steamPath ? [steamPath] : await defaultSteamRoots());
  const [game] = games;
  if (games.length !== 1 || game === undefined) {
    throw new Error(
      games.length === 0
        ? "CS2 was not found. Pass --game-path pointing to the Counter-Strike Global Offensive folder, or --steam-path."
        : `Multiple CS2 installations found. Select one with --game-path:\n${games.join("\n")}`,
    );
  }
  return game;
}
