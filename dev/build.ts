import { join } from "std/path/mod.ts";
import { collectWorkspaceConfigs, resolveBuildTasks, detectProject, resolveArtifacts, resolveCommandEnv } from "@loru/devkit";

async function run(cmd: string, cwd: string, env?: Record<string, string>) {
  const proc = new Deno.Command(Deno.env.get("SHELL") ?? "sh", {
    args: ["-c", cmd],
    cwd,
    env,
    stdin: "null",
    stdout: "inherit",
    stderr: "inherit",
  });
  const { code } = await proc.output();
  if (code !== 0) throw new Error(`Command failed: ${cmd} (cwd=${cwd})`);
}

async function runTasks(
  tasks: Array<{ cmd: string; cwd: string; name: string; env?: Record<string, string> }>,
  errors: string[],
) {
  for (const task of tasks) {
    try {
      console.log(`build:${task.name} -> ${task.cmd} (cwd=${task.cwd})`);
      await run(task.cmd, task.cwd, task.env);
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
  const workspaceRoot = configs[0].baseDir;

  const phases = ["prebuild", "build", "postbuild"];
  const errors: string[] = [];

  for (const cfg of configs) {
    const targets = [
      ...(cfg.config.plugin ?? []).map((p) => ({ id: p.id, path: p.path ?? "." })),
      ...(cfg.config.page ?? []).map((p) => ({ id: p.id, path: p.path ?? "." })),
      ...(cfg.config.lib ?? []).map((l) => ({ id: l.name, path: l.path })),
    ];

    for (const phase of phases) {
      const baseArtifacts = await resolveArtifacts(cfg.config, workspaceRoot, cfg.baseDir, "generic");
      const baseEnv = await resolveCommandEnv({
        cfg: cfg.config,
        workspaceRoot,
        projectRoot: cfg.baseDir,
        tool: "generic",
      });
      await runTasks(
        resolveBuildTasks(cfg.config, cfg.baseDir, phase).map((t) => ({
          ...t,
          env: baseEnv,
        })),
        errors,
      );
      for (const target of targets) {
        const tPath = join(cfg.baseDir, target.path);
        const targetArtifacts = await resolveArtifacts(cfg.config, workspaceRoot, tPath, "generic", target.id);
        const targetEnv = await resolveCommandEnv({
          cfg: cfg.config,
          workspaceRoot,
          projectRoot: tPath,
          tool: "generic",
          target: target.id,
        });
        await runTasks(
          resolveBuildTasks(cfg.config, cfg.baseDir, phase, target.id, tPath).map((t) => ({
            ...t,
            env: targetEnv,
          })),
          errors,
        );
      }
    }

    const buildPaths = new Set<string>([cfg.baseDir, ...targets.map((t) => join(cfg.baseDir, t.path))]);
    for (const path of buildPaths) {
      const info = await detectProject(path);
      if (info.kind === "deno") {
        const env = await resolveCommandEnv({
          cfg: cfg.config,
          workspaceRoot,
          projectRoot: path,
          tool: "deno",
        });
        await runTasks([{ cmd: "deno check", cwd: path, name: "deno-check", env }], errors);
      } else if (info.kind === "rust") {
        const env = await resolveCommandEnv({
          cfg: cfg.config,
          workspaceRoot,
          projectRoot: path,
          tool: "cargo",
        });
        await runTasks([{ cmd: "cargo build", cwd: path, name: "cargo-build", env }], errors);
      }
    }
  }

  if (errors.length) {
    throw new Error(`Build completed with errors:\n${errors.join("\n")}`);
  }
}
