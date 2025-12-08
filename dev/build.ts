import { join } from "std/path/mod.ts";
import { collectWorkspaceConfigs, resolveBuildTasks, detectProject } from "@loru/devkit";

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

async function runTasks(tasks: Array<{ cmd: string; cwd: string; name: string }>, errors: string[]) {
  for (const task of tasks) {
    try {
      console.log(`build:${task.name} -> ${task.cmd} (cwd=${task.cwd})`);
      await run(task.cmd, task.cwd);
    } catch (err) {
      errors.push(`${task.cwd}: ${(err as Error).message}`);
    }
  }
}

export async function buildHandler(_flags: Record<string, unknown>) {
  const configs = await collectWorkspaceConfigs();
  if (!configs.length) {
    console.warn("No loru.toml found.");
    return;
  }

  const phases = ["prebuild", "build", "postbuild"];
  const errors: string[] = [];

  for (const cfg of configs) {
    const targets = [
      ...(cfg.config.plugin ?? []).map((p) => ({ id: p.id, path: p.path ?? "." })),
      ...(cfg.config.page ?? []).map((p) => ({ id: p.id, path: p.path ?? "." })),
      ...(cfg.config.lib ?? []).map((l) => ({ id: l.name, path: l.path })),
    ];

    for (const phase of phases) {
      await runTasks(resolveBuildTasks(cfg.config, cfg.baseDir, phase), errors);
      for (const target of targets) {
        const tPath = join(cfg.baseDir, target.path);
        await runTasks(resolveBuildTasks(cfg.config, cfg.baseDir, phase, target.id, tPath), errors);
      }
    }

    const buildPaths = new Set<string>([cfg.baseDir, ...targets.map((t) => join(cfg.baseDir, t.path))]);
    for (const path of buildPaths) {
      const info = await detectProject(path);
      if (info.kind === "deno") {
        await runTasks([{ cmd: "deno check", cwd: path, name: "deno-check" }], errors);
      } else if (info.kind === "rust") {
        await runTasks([{ cmd: "cargo build", cwd: path, name: "cargo-build" }], errors);
      }
    }
  }

  if (errors.length) {
    throw new Error(`Build completed with errors:\n${errors.join("\n")}`);
  }
}
