import { dirname, resolve } from "std/path/mod.ts";
import { fetchSchema, loadConfig, collectWorkspaceConfigs } from "@loru/devkit";

type Action = "fetch" | "validate";

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

export async function schemasHandler(flags: Record<string, unknown>) {
  const action: Action = ((flags._ as unknown[] | undefined)?.[0] as Action) ?? "fetch";
  const configs = await collectWorkspaceConfigs();
  if (!configs.length) {
    console.warn("No loru.toml found.");
    return;
  }

  for (const cfg of configs) {
    const schemaPath = await fetchSchema({
      schema: "loru-config",
      version: cfg.config?.meta?.schema_version,
      metaFile: cfg.path,
    });
    console.log(`schema cached: ${schemaPath} for ${cfg.path}`);
    if (action === "validate") {
      await run("taplo fmt --check", cfg.baseDir);
      await run(`taplo lint --schema ${schemaPath} ${cfg.path}`, cfg.baseDir);
    }
  }
}
