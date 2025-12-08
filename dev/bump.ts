import { dirname } from "std/path/mod.ts";

export async function bumpHandler(flags: Record<string, unknown>) {
  const level = flags.level as string | undefined;
  const file = (flags.file as string | undefined) ?? "deno.json";
  if (!level || !["patch", "minor", "major"].includes(level)) {
    console.error("Usage: loru dev bump --level=patch|minor|major [--file=deno.json]");
    Deno.exit(1);
  }
  const bumpScript = new URL("../../scripts/bump-version.ts", import.meta.url).pathname;
  await run(`deno run -A ${bumpScript} --level=${level} --file=${file}`, dirname(file));
  console.log("Version bumped in", file);
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
