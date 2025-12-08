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
    case "run": {
      const task = rest[0];
      if (!task) return help();
      const ran = await runTask(task);
      if (!ran) {
        console.warn(`No task "${task}" found in workspace.`);
      }
      return;
    }
    default:
      return help();
  }
}

function help() {
  console.log(`Usage: loru <command>

Commands:
  dev ...      Development utilities (schemas, check, bump, bom, init)
  run <task>   Run workspace task defined in loru.toml
`);
}

await main();
