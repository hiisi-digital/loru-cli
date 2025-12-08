import { dirname, resolve } from "std/path/mod.ts";
import { parse as parseToml } from "std/toml/mod.ts";
import { fetchSchema } from "../../devkit.ts";

type Action = "fetch" | "validate";

interface Target {
  kind: "plugin" | "tenant";
  schemaVersion?: string;
  metaFile: string;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch {
    return false;
  }
}

async function loadConfig(): Promise<{ baseDir: string; plugins: Target[]; tenants: Target[] }> {
  const candidates = ["loru.toml", ".loru/loru.toml"];
  let cfgPath: string | undefined;
  for (const c of candidates) {
    if (await fileExists(c)) {
      cfgPath = c;
      break;
    }
  }
  const baseDir = cfgPath ? dirname(cfgPath) : Deno.cwd();
  const plugins: Target[] = [];
  const tenants: Target[] = [];

  if (cfgPath) {
    const text = await Deno.readTextFile(cfgPath);
    const cfg = parseToml(text) as { meta?: { schema_version?: string }; plugin?: Array<Record<string, unknown>>; page?: Array<Record<string, unknown>> };
    const defaultSchema = cfg.meta?.schema_version;
    for (const p of cfg.plugin ?? []) {
      const path = typeof p.path === "string" ? resolve(baseDir, p.path, "plugin.toml") : resolve(baseDir, "plugin.toml");
      plugins.push({ kind: "plugin", schemaVersion: (p as any).schema_version ?? defaultSchema, metaFile: path });
    }
    for (const t of cfg.page ?? []) {
      const path = typeof t.path === "string" ? resolve(baseDir, t.path, "tenant.toml") : resolve(baseDir, "tenant.toml");
      tenants.push({ kind: "tenant", schemaVersion: (t as any).schema_version ?? defaultSchema, metaFile: path });
    }
  }

  if (!plugins.length && (await fileExists(resolve(baseDir, "plugin.toml")))) {
    plugins.push({ kind: "plugin", metaFile: resolve(baseDir, "plugin.toml") });
  }
  if (!tenants.length && (await fileExists(resolve(baseDir, "tenant.toml")))) {
    tenants.push({ kind: "tenant", metaFile: resolve(baseDir, "tenant.toml") });
  }

  return { baseDir, plugins, tenants };
}

async function taploLint(schemaPath: string, metaFile: string) {
  const dir = dirname(metaFile);
  await run(`taplo fmt --check`, dir);
  await run(`taplo lint --schema ${schemaPath}`, dir);
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

export async function schemasHandler(flags: Record<string, unknown>) {
  const action: Action = (flags._?.[0] as Action) ?? "fetch";
  const { plugins, tenants } = await loadConfig();
  const targets = [...plugins, ...tenants];
  if (!targets.length) {
    console.warn("No plugin or tenant metadata found.");
    return;
  }

  for (const target of targets) {
    const schema = target.kind === "plugin" ? "plugin-metadata" : "tenant-metadata";
    const schemaPath = await fetchSchema({
      schema,
      version: target.schemaVersion,
      metaFile: target.metaFile,
    });
    console.log(`schema cached: ${schemaPath}`);
    if (action === "validate") {
      await taploLint(schemaPath, target.metaFile);
    }
  }
}
