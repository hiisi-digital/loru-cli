import { dirname, resolve } from "std/path/mod.ts";
import { parse as parseToml } from "std/toml/mod.ts";
import { detectProject } from "../devkit.ts";
import { schemasHandler } from "./schemas/mod.ts";

async function fileExists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch {
    return false;
  }
}

async function loadPaths(): Promise<string[]> {
  const candidates = ["loru.toml", ".loru/loru.toml"];
  let cfgPath: string | undefined;
  for (const c of candidates) {
    if (await fileExists(c)) {
      cfgPath = c;
      break;
    }
  }
  const baseDir = cfgPath ? dirname(cfgPath) : Deno.cwd();
  const paths = new Set<string>();
  if (cfgPath) {
    const text = await Deno.readTextFile(cfgPath);
    const cfg = parseToml(text) as { plugin?: Array<Record<string, unknown>>; page?: Array<Record<string, unknown>> };
    for (const p of cfg.plugin ?? []) paths.add(typeof p.path === "string" ? resolve(baseDir, p.path) : baseDir);
    for (const t of cfg.page ?? []) paths.add(typeof t.path === "string" ? resolve(baseDir, t.path) : baseDir);
  } else {
    paths.add(baseDir);
  }
  return [...paths];
}

async function run(cmd: string, cwd: string) {
  const proc = new Deno.Command(Deno.env.get("SHELL") ?? "sh", {
    args: ["-c", cmd],
    cwd,
    stdin: "null",
    stdout: "inherit",
    stderr: "inherit",
  });
  const { code } = await proc.output();
  if (code !== 0) throw new Error(`Command failed: ${cmd} (cwd=${cwd})`);
}

export async function checkHandler(flags: Record<string, unknown>) {
  // Validate schemas first
  await schemasHandler({ _: ["validate"] });

  // Collect projects and run language checks
  const paths = await loadPaths();
  for (const p of paths) {
    const info = await detectProject(p);
    if (info.kind === "deno") {
      await run("deno fmt --check", p);
      await run("deno lint", p);
    } else if (info.kind === "rust") {
      await run("cargo fmt --check", p);
      await run("cargo check", p);
    }
  }
}
