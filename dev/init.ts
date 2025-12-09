import { initBuildSystem } from "@loru/devkit";
import { hooksHandler } from "./hooks.ts";

export async function initHandler(
  args: string[],
  flags: Record<string, unknown>,
) {
  const sub = args[0];
  switch (sub) {
    case "githooks":
      return await hooksHandler(flags);
    case "buildsys":
      return await initBuildSystem();
    default:
      return initHelp();
  }
}

function initHelp() {
  console.log(`Usage: loru dev init <githooks|buildsys>`);
}
