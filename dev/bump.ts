import { bumpAndRelease } from "@loru/devkit";

export async function bumpHandler(flags: Record<string, unknown>) {
  const level = flags.level as string | undefined;
  if (!level || !["patch", "minor", "major"].includes(level)) {
    console.error("Usage: loru dev bump --level=patch|minor|major");
    Deno.exit(1);
  }
  await bumpAndRelease(level as any);
}
