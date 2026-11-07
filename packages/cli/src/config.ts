import { randomBytes } from "node:crypto";
import { lstat, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { configDirectory } from "./discovery";
import { asObject, parseKeyValues } from "./keyvalues";

export const filename = "gamestate_integration_counter_strike_2_gsi.cfg";
const marker = "// Managed by @counter-strike-2-gsi/cli; format=1";
export const components = [
  "provider",
  "map",
  "round",
  "player_id",
  "player_state",
  "player_weapons",
  "player_match_stats",
  "allplayers_id",
  "allplayers_state",
  "allplayers_match_stats",
  "allplayers_weapons",
  "allplayers_position",
  "phase_countdowns",
  "bomb",
  "grenades",
] as const;
export type Component = (typeof components)[number];

export function isComponent(value: string): value is Component {
  return components.some((component) => component === value);
}

export function parseComponents(values: string[]): Component[] {
  const selected = values.filter(isComponent);
  if (!selected.length || selected.length !== values.length) {
    throw new Error(`Unknown or empty components. Supported: ${components.join(",")}`);
  }
  return selected;
}

export interface Configuration {
  uri: string;
  token: string;
  data: Component[];
}

export function validateUri(uri: string): URL {
  const url = new URL(uri);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.hash) {
    throw new Error("Endpoint must be an HTTP(S) URL without credentials or a fragment.");
  }
  if (url.port === "0") throw new Error("Endpoint port must be between 1 and 65535.");
  return url;
}

function quote(value: string): string {
  if (
    value
      .split("")
      .some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
  )
    throw new Error("Config values cannot contain control characters.");
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export function renderConfig(config: Configuration): string {
  validateUri(config.uri);
  if (!config.token) throw new Error("Token cannot be empty.");
  parseComponents(config.data);
  return `${marker}\n"Counter-Strike 2 GSI"\n{\n  "uri" ${quote(config.uri)}\n  "timeout" "5.0"\n  "buffer" "0.1"\n  "throttle" "0.1"\n  "heartbeat" "10.0"\n  "auth"\n  {\n    "token" ${quote(config.token)}\n  }\n  "data"\n  {\n${[...new Set(config.data)].map((key) => `    ${quote(key)} "1"`).join("\n")}\n  }\n}\n`;
}

export async function readConfig(
  path: string,
  overrides: Partial<Configuration> = {},
): Promise<Configuration | undefined> {
  try {
    const info = await lstat(path);
    if (!info.isFile() || info.isSymbolicLink())
      throw new Error(`Refusing to modify a non-regular config: ${path}`);
    const text = (await readFile(path, "utf8")).replace(/^\uFEFF/, "");
    if (text.split(/\r?\n/, 1)[0] !== marker)
      throw new Error(`Config is not managed by this CLI; move it aside first: ${path}`);
    const config = asObject(parseKeyValues(text)["Counter-Strike 2 GSI"]);
    const token = overrides.token ?? asObject(config.auth).token;
    const uri = overrides.uri ?? config.uri;
    if (typeof uri !== "string" || typeof token !== "string")
      throw new Error("Managed config is malformed.");
    const result = {
      uri,
      token,
      data:
        overrides.data ??
        parseComponents(
          Object.entries(asObject(config.data))
            .filter(([, enabled]) => enabled === "1")
            .map(([key]) => key),
        ),
    };
    renderConfig(result);
    return result;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

export async function installConfig(
  game: string,
  options: Partial<Configuration>,
): Promise<{ path: string; changed: boolean }> {
  const path = join(await configDirectory(game), filename);
  const existing = await readConfig(path, options);
  const content = renderConfig({
    uri: options.uri ?? existing?.uri ?? "http://127.0.0.1:3000/gsi",
    token: options.token ?? existing?.token ?? randomBytes(32).toString("hex"),
    data: options.data ?? existing?.data ?? [...components],
  });
  if (existing && (await readFile(path, "utf8")) === content) return { path, changed: false };
  if (!existing) {
    await writeFile(path, content, { flag: "wx", mode: 0o600 });
  } else {
    const temporary = `${path}.${randomBytes(8).toString("hex")}.tmp`;
    try {
      await writeFile(temporary, content, { flag: "wx", mode: 0o600 });
      await rename(temporary, path);
    } finally {
      await unlink(temporary).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== "ENOENT") throw error;
      });
    }
  }
  return { path, changed: true };
}
