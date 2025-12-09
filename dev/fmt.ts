import { join } from "std/path/mod.ts";
import {
  collectWorkspaceConfigs,
  detectProject,
  resolveCheckTasks,
  resolveCommandEnv,
} from "@loru/devkit";
import { schemasHandler } from "./schemas/mod.ts";
import { defaultTasks, parseSkip, runTasks, type Task } from "./task_runner.ts";

const stages = ["fmt", "lint"] as const;

export async function fmtHandler(flags: Record<string, unknown>) {
  const rawSkip = (flags.skip as string | undefined) ?? "";
  const skip = parseSkip(flags);

  if (!skip.has("toml") && !skip.has("all")) {
    await schemasHandler({ _: ["fmt"], skip: rawSkip });
  } else {
    console.warn("Skipping TOML format/lint due to --skip flag (toml/all).");
  }

  const configs = await collectWorkspaceConfigs();
  if (!configs.length) {
    console.warn("No loru.toml found.");
    return;
  }

  const errors: string[] = [];
  const workspaceRoot = configs[0].baseDir;
  for (const cfg of configs) {
    const targets = [
      ...(cfg.config.plugin ?? []).map((p) => ({
        id: p.id,
        path: p.path ?? ".",
      })),
      ...(cfg.config.page ?? []).map((p) => ({
        id: p.id,
        path: p.path ?? ".",
      })),
      ...(cfg.config.lib ?? []).map((l) => ({ id: l.name, path: l.path })),
    ];

    const paths = new Map<string, string | undefined>();
    paths.set(cfg.baseDir, undefined);
    for (const target of targets) {
      paths.set(join(cfg.baseDir, target.path), target.id);
    }

    const defaults: Task[] = [];
    for (const [path] of paths) {
      const info = await detectProject(path);
      if (
        skip.has("all") ||
        (info.kind === "deno" && skip.has("ts")) ||
        (info.kind === "rust" && skip.has("rust"))
      ) {
        console.warn(
          `Skipping default fmt/lint for ${info.kind} project at ${path} due to --skip flag.`,
        );
        continue;
      }
      const baseEnv = await resolveCommandEnv({
        cfg: cfg.config,
        workspaceRoot,
        projectRoot: path,
        tool: info.kind === "rust"
          ? "cargo"
          : info.kind === "deno"
          ? "deno"
          : "generic",
      });
      defaults.push(
        ...defaultTasks(info.kind, "fmt").map((t) => ({
          ...t,
          cwd: path,
          env: baseEnv,
        })),
      );
    }

    for (const stage of stages) {
      if (skip.has("all") || skip.has(stage)) {
        console.warn(`Skipping stage "${stage}" due to --skip flag.`);
        continue;
      }
      const stageTasks: Task[] = [];
      const baseEnv = await resolveCommandEnv({
        cfg: cfg.config,
        workspaceRoot,
        projectRoot: cfg.baseDir,
        tool: "generic",
      });
      stageTasks.push(
        ...resolveCheckTasks(cfg.config, cfg.baseDir, stage).map((t) => ({
          ...t,
          env: baseEnv,
        })),
      );

      for (const target of targets) {
        const targetPath = join(cfg.baseDir, target.path);
        if (skip.has("all") || skip.has("ts")) {
          console.warn(
            `Skipping configured tasks for target ${
              target.id ?? target.path
            } due to --skip flag.`,
          );
          continue;
        }
        const env = await resolveCommandEnv({
          cfg: cfg.config,
          workspaceRoot,
          projectRoot: targetPath,
          tool: "generic",
          target: target.id,
        });
        stageTasks.push(
          ...resolveCheckTasks(
            cfg.config,
            cfg.baseDir,
            stage,
            target.id,
            targetPath,
          ).map((t) => ({ ...t, env })),
        );
      }

      stageTasks.push(...defaults.filter((t) => t.stage === stage));
      await runTasks(stageTasks, errors, "fmt");
    }
  }

  if (errors.length) {
    throw new Error(`Fmt completed with errors:\n${errors.join("\n")}`);
  }
}
