#!/usr/bin/env -S deno run -A
import { parse } from "std/flags/mod.ts";

type Level = "patch" | "minor" | "major";

function bumpVersion(current: string, level: Level): string {
  const [maj, min, pat] = current.split(".").map((n) => parseInt(n, 10));
  if ([maj, min, pat].some((n) => Number.isNaN(n))) {
    throw new Error(`Invalid version: ${current}`);
  }
  switch (level) {
    case "patch":
      return `${maj}.${min}.${pat + 1}`;
    case "minor":
      return `${maj}.${min + 1}.0`;
    case "major":
      return `${maj + 1}.0.0`;
  }
}

async function main() {
  const args = parse(Deno.args);
  const level = args.level as Level | undefined;
  const file = (args.file as string | undefined) ?? "deno.json";
  if (!level || !["patch", "minor", "major"].includes(level)) {
    console.error("Usage: loru dev bump-version --level=patch|minor|major [--file=deno.json]");
    Deno.exit(1);
  }

  const raw = await Deno.readTextFile(file);
  const json = JSON.parse(raw) as { version?: string };
  const current = json.version ?? "0.0.0";
  const next = bumpVersion(current, level);

  json.version = next;
  await Deno.writeTextFile(file, JSON.stringify(json, null, 2) + "\n");
  console.log(next);
}

if (import.meta.main) {
  await main();
}
