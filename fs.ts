import { join } from "std/path";
import { exists } from "std/fs/mod.ts";

export type ProjectKind = "deno" | "rust";

export interface ProjectInfo {
  path: string;
  kind: ProjectKind;
}

export async function detectProject(path: string): Promise<ProjectInfo | undefined> {
  const denoJson = join(path, "deno.json");
  const denoJsonc = join(path, "deno.jsonc");
  const cargoToml = join(path, "Cargo.toml");
  if (await exists(denoJson) || await exists(denoJsonc)) return { path, kind: "deno" };
  if (await exists(cargoToml)) return { path, kind: "rust" };
  return undefined;
}

export async function runChecks(projects: ProjectInfo[]): Promise<void> {
  for (const proj of projects) {
    if (proj.kind === "deno") {
      await run("deno fmt --check", proj.path);
      await run("deno lint", proj.path);
    } else if (proj.kind === "rust") {
      await run("cargo fmt --check", proj.path);
      await run("cargo check", proj.path);
    }
  }
}

async function run(cmd: string, cwd: string): Promise<void> {
  const proc = new Deno.Command(Deno.env.get("SHELL") ?? "sh", {
    args: ["-c", cmd],
    cwd,
    stdin: "null",
    stdout: "inherit",
    stderr: "inherit",
  });
  const { code } = await proc.output();
  if (code !== 0) {
    throw new Error(`Command failed: ${cmd} (cwd=${cwd})`);
  }
}
