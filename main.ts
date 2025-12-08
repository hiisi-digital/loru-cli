#!/usr/bin/env -S deno run -A
import { parse } from "std/flags/mod.ts";
import devHandler from "./dev/mod.ts";
import { runTask } from "./tasks.ts";

const args = parse(Deno.args);
const [cmd, ...rest] = args._.map(String);

async function main() {
  switch (cmd) {
    case "dev":
      await devHandler(rest, args);
      return;
    default:
      // fallback to task execution
      if (cmd) {
        const ran = await runTask(cmd);
        if (ran) return;
      }
      return help();
  }
}

function help() {
  console.log(`Usage: loru <command>

Commands:
  dev ...      Development utilities (schemas, check, bump, bom)
`);
}

await main();
