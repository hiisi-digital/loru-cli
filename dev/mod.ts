import { parse } from "std/flags/mod.ts";
import { schemasHandler } from "./schemas/mod.ts";
import { checkHandler } from "./check.ts";
import { bumpHandler } from "./bump.ts";
import { bomHandler } from "./bom/mod.ts";
import { hooksHandler } from "./hooks.ts";

export default async function dev(args: string[], raw: Record<string, unknown>) {
  const [sub, ...rest] = args;
  const flags = parse(rest);

  switch (sub) {
    case "schemas":
      return await schemasHandler(flags);
    case "check":
      return await checkHandler(flags);
    case "bump":
      return await bumpHandler(flags);
    case "bom":
      return await bomHandler(flags);
    case "hooks":
      return await hooksHandler(flags);
    default:
      return devHelp();
  }
}

function devHelp() {
  console.log(`Usage: loru dev <subcommand>

Subcommands:
  schemas fetch|validate
  check
  bump --level=patch|minor|major [--file=deno.json]
  bom fetch
`);
}
