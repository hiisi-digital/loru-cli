#!/usr/bin/env -S deno run -A
import { parse } from "std/flags/mod.ts";
import { dirname, join, resolve } from "std/path/mod.ts";
import { loadConfig } from "./config.ts";
import { fetchSchema, fetchBom } from "./devkit.ts";
import { detectProject, runChecks } from "./fs.ts";
import { PluginEntry, PageEntry } from "./types.ts";

type Command = "dev";
type DevCommand = "schemas" | "check" | "bump-version" | "bom";
type SchemaSub = "fetch" | "validate";
type BomSub = "fetch";

const args = parse(Deno.args, { string: ["level", "file", "version"] });

async function main() {
  const [cmd, sub, action] = args._.map(String);

  if (!cmd) return help();
  if (cmd !== "dev") return help(`Unknown command: ${cmd}`);

  if (!sub) return devHelp();

  if (sub === "schemas") {
    const op = (action as SchemaSub) ?? "fetch";
    if (!["fetch", "validate"].includes(op)) return devHelp("Unknown schemas action");
    await handleSchemas(op as SchemaSub);
    return;
  }

  if (sub === "bom") {
    const op = (action as BomSub) ?? "fetch";
    if (!["fetch"].includes(op)) return devHelp("Unknown bom action");
    await handleBom();
    return;
  }

  if (sub === "check") {
    await handleCheck();
    return;
  }

  if (sub === "bump-version") {
    await handleBump();
    return;
  }

  return devHelp(`Unknown subcommand: ${sub}`);
}

async function handleSchemas(op: SchemaSub) {
  const { config, path: cfgPath } = await loadConfig();
  const baseDir = cfgPath ? dirname(cfgPath) : Deno.cwd();
  const plugins = config?.plugin ?? [];
  const pages = config?.page ?? [];

  // If no config, attempt to lint/fetch top-level plugin.toml / tenant.toml
  const targets: Array<{ kind: "plugin" | "tenant"; schemaVersion?: string; metaFile?: string }> = [];
  if (plugins.length) {
    for (const p of plugins) {
      const meta = p.path ? resolve(baseDir, p.path, "plugin.toml") : resolve(baseDir, "plugin.toml");
      targets.push({ kind: "plugin", schemaVersion: p.schema_version, metaFile: meta });
    }
  } else if (await fileExists(resolve(baseDir, "plugin.toml"))) {
    targets.push({ kind: "plugin", metaFile: resolve(baseDir, "plugin.toml") });
  }
  if (pages.length) {
    for (const t of pages) {
      const meta = t.path ? resolve(baseDir, t.path, "tenant.toml") : resolve(baseDir, "tenant.toml");
      targets.push({ kind: "tenant", schemaVersion: t.schema_version, metaFile: meta });
    }
  } else if (await fileExists(resolve(baseDir, "tenant.toml"))) {
    targets.push({ kind: "tenant", metaFile: resolve(baseDir, "tenant.toml") });
  }

  if (!targets.length) {
    console.warn("No plugin/page metadata found (loru.toml, plugin.toml, tenant.toml)");
    return;
  }

  for (const target of targets) {
    const schema = target.kind === "plugin" ? "plugin-metadata" : "tenant-metadata";
    const path = await fetchSchema({
      schema,
      version: target.schemaVersion ?? config?.meta?.schema_version,
      metaFile: target.metaFile,
      cacheDir: ".loru/cache/schemas",
    });
    console.log(`schema cached: ${path}`);
    if (op === "validate") {
      const metaFile = target.metaFile ?? (target.kind === "plugin" ? resolve(baseDir, "plugin.toml") : resolve(baseDir, "tenant.toml"));
      const metaDir = dirname(metaFile);
      await run(`taplo fmt --check`, metaDir);
      await run(`taplo lint --schema ${path}`, metaDir);
    }
  }
}

async function handleBom() {
  const path = await fetchBom({ cacheDir: ".loru/cache/boms", version: args.version as string | undefined });
  console.log(path);
}

async function handleCheck() {
  await handleSchemas("validate");
  const { config, path } = await loadConfig();
  const baseDir = path ? dirname(path) : Deno.cwd();
  const projects = await collectProjects(config?.plugin ?? [], config?.page ?? [], baseDir);
  await runChecks(projects);
}

async function handleBump() {
  const level = args.level as string | undefined;
  const file = (args.file as string | undefined) ?? "deno.json";
  if (!level || !["patch", "minor", "major"].includes(level)) {
    console.error("Usage: loru dev bump-version --level=patch|minor|major [--file=deno.json]");
    Deno.exit(1);
  }
  const bumpScript = new URL("./bump.ts", import.meta.url).pathname;
  await run(`deno run -A ${bumpScript} --level=${level} --file=${file}`, Deno.cwd());
  console.log("Version bumped in", file);
}

async function collectProjects(plugins: PluginEntry[], pages: PageEntry[], baseDir: string) {
  const paths = new Set<string>();
  for (const p of plugins) if (p.path) paths.add(resolve(baseDir, p.path)); else paths.add(baseDir);
  for (const t of pages) if (t.path) paths.add(resolve(baseDir, t.path)); else paths.add(baseDir);
  const results = [];
  for (const p of paths) {
    const info = await detectProject(p);
    if (info) results.push(info);
  }
  return results;
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

async function fileExists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch {
    return false;
  }
}

function dirname(path: string): string {
  const parts = path.split("/");
  parts.pop();
  return parts.join("/") || ".";
}

function help(msg?: string) {
  if (msg) console.error(msg);
  console.log(`Usage: loru <command> [subcommand]

Commands:
  dev schemas fetch|validate
  dev check
  dev bom fetch
  dev bump-version --level=patch|minor|major [--file=deno.json]
`);
  Deno.exit(msg ? 1 : 0);
}

function devHelp(msg?: string) {
  if (msg) console.error(msg);
  console.log(`Usage: loru dev <subcommand>

Subcommands:
  schemas fetch
  schemas validate
  check
  bom fetch
  bump-version --level=patch|minor|major [--file=deno.json]
`);
  Deno.exit(msg ? 1 : 0);
}

await main();
