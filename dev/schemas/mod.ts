import { dirname, resolve } from "std/path/mod.ts";
import { fetchSchema, loadConfig } from "https://raw.githubusercontent.com/hiisi-digital/loru-devkit/v0.2.1/deno/mod.ts";

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
  const action: Action = (flags._?.[0] as Action) ?? "fetch";
  const base = await loadConfig();
  if (!base.config || !base.path) {
    console.warn("No loru.toml found.");
    return;
  }

  const cfgPaths = new Set<string>();
  cfgPaths.add(base.path);
  for (const m of base.config.workspace?.members ?? []) {
    const memberCfg = await loadConfig(undefined, resolve(dirname(base.path), m));
    if (memberCfg.path) cfgPaths.add(memberCfg.path);
  }

  for (const cfgPath of cfgPaths) {
    const cfg = await loadConfig(cfgPath, dirname(cfgPath));
    const schemaPath = await fetchSchema({
      schema: "loru-config",
      version: cfg.config?.meta?.schema_version,
      metaFile: cfgPath,
    });
    console.log(`schema cached: ${schemaPath} for ${cfgPath}`);
    if (action === "validate") {
      const dir = dirname(cfgPath);
      await run("taplo fmt --check", dir);
      await run(`taplo lint --schema ${schemaPath} ${cfgPath}`, dir);
    }
  }
}
