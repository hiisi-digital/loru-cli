import { bumpAndRelease, resumeReleases } from "@loru/devkit";

export async function bumpHandler(flags: Record<string, unknown>) {
  const fixMissing = Boolean(flags["fix-missing"]);
  const resume = Boolean(flags["resume"]);
  const level = flags.level as string | undefined;

  if (resume) {
    if (fixMissing) {
      console.warn("Resuming pending releases with --fix-missing: missing tags/releases will be backfilled without bumping.");
    } else {
      console.warn("Resuming pending releases (no new bumps).");
    }
    await resumeReleases({ fixMissing });
    return;
  }

  if (!level || !["patch", "minor", "major"].includes(level)) {
    console.error("Usage: loru dev bump --level=patch|minor|major [--fix-missing] [--resume]");
    Deno.exit(1);
  }
  if (fixMissing) {
    console.warn("Running with --fix-missing: existing versions without tags/releases will be backfilled before bumping.");
  }
  await bumpAndRelease(level as any, { fixMissing });
}
