import { collectWorkspaceConfigs, fetchSchema } from "@loru/devkit";
import { join } from "std/path/mod.ts";
import { parseSkip, runCommand } from "../task_runner.ts";

type Action = "fetch" | "validate" | "fmt";

async function ensureCommand(cmd: string, installHints: string): Promise<void> {
  const proc = new Deno.Command(Deno.env.get("SHELL") ?? "sh", {
    args: ["-c", `command -v ${cmd}`],
    stdin: "null",
    stdout: "null",
    stderr: "null",
  });
  const { code } = await proc.output();
  if (code !== 0) {
    throw new Error(
      `Required tool "${cmd}" is missing. Install: ${installHints}. ` +
        `Or rerun with --skip=toml to explicitly skip TOML validation.`,
    );
  }
}

export async function schemasHandler(flags: Record<string, unknown>) {
  const action: Action = ((flags._ as unknown[] | undefined)?.[0] as Action) ??
    "fetch";
  const skip = parseSkip(flags);
  const configs = await collectWorkspaceConfigs();
  if (!configs.length) {
    console.warn("No loru.toml found.");
    return;
  }

  for (const cfg of configs) {
    let schemaPath = join(cfg.baseDir, "definitions", "loru-config.json");
    try {
      await Deno.stat(schemaPath);
    } catch {
      schemaPath = await fetchSchema({
        schema: "loru-config",
        version: cfg.config?.meta?.schema_version,
        metaFile: cfg.path,
      });
    }
    console.log(`schema cached: ${schemaPath} for ${cfg.path}`);
    if (action === "validate" || action === "fmt") {
      if (skip.has("all") || skip.has("toml")) {
        console.warn("Skipping TOML validation due to --skip flag (toml/all).");
        continue;
      }
      await ensureCommand(
        "taplo",
        "cargo install taplo-cli or brew install taplo",
      );
      const schemaUrl = new URL(`file://${schemaPath}`).href;
      const fmtCmd = action === "fmt" ? "taplo fmt" : "taplo fmt --check";
      await runCommand(
        { name: "taplo-fmt", cmd: fmtCmd, cwd: cfg.baseDir },
        "schema",
      );
      await runCommand(
        {
          name: "taplo-lint",
          cmd: `taplo lint --schema ${schemaUrl} ${cfg.path}`,
          cwd: cfg.baseDir,
        },
        "schema",
      );
    }
  }
}
