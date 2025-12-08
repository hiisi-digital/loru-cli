import { dirname } from "std/path/mod.ts";
import {
  fetchSchema,
  loadConfig,
  resolveMetaFile,
  fileExists,
} from "https://raw.githubusercontent.com/hiisi-digital/loru-devkit/main/deno/mod.ts";

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
  const { config, baseDir } = await loadConfig();

  const targets: Array<{ kind: "plugin" | "tenant"; schemaVersion?: string; metaFile: string }> = [];
  for (const p of config?.plugin ?? []) {
    targets.push({
      kind: "plugin",
      schemaVersion: p.schema_version ?? config?.meta?.schema_version,
      metaFile: resolveMetaFile(baseDir, p.path, "plugin"),
    });
  }
  for (const t of config?.page ?? []) {
    targets.push({
      kind: "tenant",
      schemaVersion: t.schema_version ?? config?.meta?.schema_version,
      metaFile: resolveMetaFile(baseDir, t.path, "tenant"),
    });
  }

  // fallbacks if no config
  if (!targets.length) {
    if (await fileExists("plugin.toml")) targets.push({ kind: "plugin", metaFile: "plugin.toml" });
    if (await fileExists("tenant.toml")) targets.push({ kind: "tenant", metaFile: "tenant.toml" });
  }

  if (!targets.length) {
    console.warn("No plugin or tenant metadata found.");
    return;
  }

  for (const target of targets) {
    const schema = target.kind === "plugin" ? "plugin-metadata" : "tenant-metadata";
    const schemaPath = await fetchSchema({
      schema,
      version: target.schemaVersion ?? config?.meta?.schema_version,
      metaFile: target.metaFile,
    });
    console.log(`schema cached: ${schemaPath}`);
    if (action === "validate") {
      const dir = dirname(target.metaFile);
      await run("taplo fmt --check", dir);
      await run(`taplo lint --schema ${schemaPath}`, dir);
    }
  }
}
