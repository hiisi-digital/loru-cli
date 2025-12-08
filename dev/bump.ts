import { bumpJsonVersion } from "https://raw.githubusercontent.com/hiisi-digital/loru-devkit/v0.2.0/deno/mod.ts";

export async function bumpHandler(flags: Record<string, unknown>) {
  const level = flags.level as string | undefined;
  const file = (flags.file as string | undefined) ?? "deno.json";
  if (!level || !["patch", "minor", "major"].includes(level)) {
    console.error("Usage: loru dev bump --level=patch|minor|major [--file=deno.json]");
    Deno.exit(1);
  }
  const next = await bumpJsonVersion(file, level as any);
  console.log("Version bumped in", file, "->", next);
}
