import { resolveTasks, collectWorkspaceConfigs, resolveArtifacts, resolveCommandEnv } from "@loru/devkit";

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

export async function runTask(name: string): Promise<boolean> {
  const configs = await collectWorkspaceConfigs();
  if (!configs.length) return false;
  const workspaceRoot = configs[0].baseDir;
  let ran = false;
  const errors: string[] = [];

  for (const cfg of configs) {
    const baseEnv = await resolveCommandEnv({
      cfg: cfg.config,
      workspaceRoot,
      projectRoot: cfg.baseDir,
      tool: "generic",
    });
    const tasks = resolveTasks(cfg.config, cfg.baseDir, name);
    for (const t of tasks) {
      ran = true;
      console.log(`Running task ${t.name} in ${t.cwd}: ${t.cmd}`);
      try {
        await run(t.cmd, t.cwd, baseEnv);
      } catch (err) {
        errors.push(`${t.cwd}: ${(err as Error).message}`);
      }
    }
  }

  if (errors.length) {
    throw new Error(`Task "${name}" completed with errors:\n${errors.join("\n")}`);
  }
  return ran;
}
