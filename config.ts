import { dirname, join } from "std/path";
import { parse as parseToml } from "std/toml";
import { LoruConfig } from "./types.ts";

const CONFIG_FILES = ["loru.toml", ".loru/loru.toml"];

async function fileExists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch {
    return false;
  }
}

export async function findConfig(startDir = Deno.cwd()): Promise<string | undefined> {
  let dir = startDir;
  while (true) {
    for (const cfg of CONFIG_FILES) {
      const candidate = join(dir, cfg);
      if (await fileExists(candidate)) return candidate;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return undefined;
}

export async function loadConfig(path?: string): Promise<{ path?: string; config?: LoruConfig }> {
  const cfgPath = path ?? (await findConfig());
  if (!cfgPath) return {};
  const text = await Deno.readTextFile(cfgPath);
  const parsed = parseToml(text) as LoruConfig;
  return { path: cfgPath, config: parsed };
}
