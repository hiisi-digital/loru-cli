import { dirname, resolve } from "std/path/mod.ts";
import { parse as parseToml } from "std/toml/mod.ts";
import { detectProject, loadConfig } from "https://raw.githubusercontent.com/hiisi-digital/loru-devkit/v0.2.1/deno/mod.ts";
import { schemasHandler } from "./schemas/mod.ts";

async function fileExists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch {
    return false;
  }
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

export async function checkHandler(_flags: Record<string, unknown>) {
  await schemasHandler({ _: ["validate"] });

  const { path, baseDir, config } = await loadConfig();
  const paths = new Set<string>();
  paths.add(baseDir);
  for (const m of config?.workspace?.members ?? []) {
    paths.add(resolve(baseDir, m));
  }

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
