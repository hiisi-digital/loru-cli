import { join, dirname, fromFileUrl } from "std/path/mod.ts";
import { ensureDir } from "std/fs/mod.ts";
import { collectWorkspaceConfigs } from "@loru/devkit";

const commitMsgHook = `#!/usr/bin/env sh
msg_file="$1"
msg="$(cat "$msg_file")"
conventional='^(feat|fix|chore|docs|style|refactor|perf|test|build|ci|revert)(\\([^\)]*\\))?: .+'
if ! printf "%s" "$msg" | grep -Eq "$conventional"; then
  echo "❌ Commit message must follow Conventional Commits (type(scope): summary)" >&2
  exit 1
fi
`;

const cliRoot = dirname(dirname(fromFileUrl(import.meta.url)));

const prePushHook = `#!/usr/bin/env sh
if [ "\${SKIP_LORU_HOOKS}" = "1" ]; then
  exit 0
fi
token="\${LORU_GITHUB_TOKEN:-\${GITHUB_TOKEN:-}}"
if [ -n "$token" ]; then
  export DENO_AUTH_TOKENS="$token@raw.githubusercontent.com"
fi
if command -v loru >/dev/null 2>&1; then
  loru dev check
else
  deno run -A --config="${cliRoot}/deno.json" "${cliRoot}/main.ts" dev check
fi
`;

async function installHooks(baseDir: string) {
  const hookDir = join(baseDir, ".githooks");
  await ensureDir(hookDir);
  await Deno.writeTextFile(join(hookDir, "commit-msg"), commitMsgHook, { mode: 0o755 });
  await Deno.writeTextFile(join(hookDir, "pre-push"), prePushHook, { mode: 0o755 });
  await Deno.chmod(join(hookDir, "commit-msg"), 0o755);
  await Deno.chmod(join(hookDir, "pre-push"), 0o755);
  await new Deno.Command("git", { args: ["-C", baseDir, "config", "core.hooksPath", ".githooks"] }).output();
  console.log(`Installed git hooks in ${baseDir}`);
}

export async function hooksHandler(_flags: Record<string, unknown>) {
  const configs = await collectWorkspaceConfigs();
  if (!configs.length) {
    console.warn("No loru.toml found; skipping hooks.");
    return;
  }
  for (const cfg of configs) {
    await installHooks(cfg.baseDir);
  }
}
