import { join } from "std/path/mod.ts";
import { collectWorkspaceConfigs, detectProject, resolveCheckTasks, resolveArtifacts, resolveCommandEnv, type ProjectKind } from "@loru/devkit";
import { schemasHandler } from "./schemas/mod.ts";

type CheckStage = "precheck" | "fmt" | "lint" | "check" | "test" | "postcheck";

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

function defaultCheckTasks(kind: ProjectKind, cwd: string): Array<{ stage: CheckStage; cmd: string; cwd: string; name: string }> {
  switch (kind) {
    case "deno":
      return [
        { stage: "fmt", cmd: "deno fmt --check", cwd, name: "deno-fmt-check" },
        { stage: "lint", cmd: "deno lint", cwd, name: "deno-lint" },
      ];
    case "rust":
      return [
        { stage: "fmt", cmd: "cargo fmt -- --check", cwd, name: "cargo-fmt-check" },
        { stage: "check", cmd: "cargo check", cwd, name: "cargo-check" },
      ];
    default:
      return [];
  }
}

async function runTasks(
  tasks: Array<{ cmd: string; cwd: string; name: string; env?: Record<string, string> }>,
  errors: string[],
) {
  for (const task of tasks) {
    try {
      console.log(`check:${task.name} -> ${task.cmd} (cwd=${task.cwd})`);
      await run(task.cmd, task.cwd, task.env);
    } catch (err) {
      errors.push(`${task.cwd}: ${(err as Error).message}`);
    }
  }
}

export async function checkHandler(_flags: Record<string, unknown>) {
  await schemasHandler({ _: ["validate"] });

  const configs = await collectWorkspaceConfigs();
  if (!configs.length) {
    console.warn("No loru.toml found.");
    return;
  }

  const stages: CheckStage[] = ["precheck", "fmt", "lint", "check", "test", "postcheck"];
  const errors: string[] = [];
  const workspaceRoot = configs[0].baseDir;

  for (const cfg of configs) {
    const targets = [
      ...(cfg.config.plugin ?? []).map((p) => ({ id: p.id, path: p.path ?? "." })),
      ...(cfg.config.page ?? []).map((p) => ({ id: p.id, path: p.path ?? "." })),
      ...(cfg.config.lib ?? []).map((l) => ({ id: l.name, path: l.path })),
    ];

    const paths = new Map<string, string | undefined>();
    paths.set(cfg.baseDir, undefined);
    for (const target of targets) {
      paths.set(join(cfg.baseDir, target.path), target.id);
    }

    const defaults = [];
    for (const [path] of paths) {
      const info = await detectProject(path);
      const baseEnv = await resolveCommandEnv({
        cfg: cfg.config,
        workspaceRoot,
        projectRoot: path,
        tool: info.kind === "rust" ? "cargo" : info.kind === "deno" ? "deno" : "generic",
      });
      defaults.push(...defaultCheckTasks(info.kind, path).map((t) => ({ ...t, env: baseEnv })));
    }

    for (const stage of stages) {
      const stageTasks: Array<{ cmd: string; cwd: string; name: string; env?: Record<string, string> }> = [];
      const baseArtifacts = await resolveArtifacts(cfg.config, workspaceRoot, cfg.baseDir, "generic");
      const baseEnv = await resolveCommandEnv({
        cfg: cfg.config,
        workspaceRoot,
        projectRoot: cfg.baseDir,
        tool: "generic",
      });
      stageTasks.push(...resolveCheckTasks(cfg.config, cfg.baseDir, stage).map((t) => ({ ...t, env: baseEnv })));

      for (const target of targets) {
        const targetPath = join(cfg.baseDir, target.path);
        const env = await resolveCommandEnv({
          cfg: cfg.config,
          workspaceRoot,
          projectRoot: targetPath,
          tool: "generic",
          target: target.id,
        });
        stageTasks.push(
          ...resolveCheckTasks(cfg.config, cfg.baseDir, stage, target.id, targetPath).map((t) => ({ ...t, env })),
        );
      }

      stageTasks.push(...defaults.filter((t) => t.stage === stage));
      await runTasks(stageTasks, errors);
    }
  }

  if (errors.length) {
    throw new Error(`Check completed with errors:\n${errors.join("\n")}`);
  }
}
