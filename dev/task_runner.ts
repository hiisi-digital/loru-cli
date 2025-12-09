export interface Task {
  name: string;
  cmd: string;
  cwd: string;
  stage?: string;
  env?: Record<string, string>;
}

export function parseSkip(flags: Record<string, unknown>): Set<string> {
  const raw = (flags.skip as string | undefined) ?? "";
  return new Set(
    raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
  );
}

/**
 * Execute a single task with optional environment overrides.
 * Throws on non-zero exit, following the fail-fast policy.
 */
export async function runCommand(
  task: Task,
  label = "task",
): Promise<void> {
  console.log(`${label}:${task.name} -> ${task.cmd} (cwd=${task.cwd})`);
  const proc = new Deno.Command(Deno.env.get("SHELL") ?? "sh", {
    args: ["-c", task.cmd],
    cwd: task.cwd,
    env: task.env,
    stdin: "null",
    stdout: "inherit",
    stderr: "inherit",
  });
  const { code } = await proc.output();
  if (code !== 0) {
    throw new Error(
      `Command failed: ${task.cmd} (cwd=${task.cwd}, label=${label})`,
    );
  }
}

/**
 * Run a set of tasks, collecting errors instead of stopping after the first one.
 */
export async function runTasks(
  tasks: Task[],
  errors: string[],
  label = "task",
): Promise<void> {
  for (const task of tasks) {
    try {
      await runCommand(task, label);
    } catch (err) {
      errors.push(`${task.cwd}: ${(err as Error).message}`);
    }
  }
}

/**
 * Built-in defaults per project type for either check (read-only) or fmt (mutating).
 * Stages are set so callers can merge them with configured pipeline tasks.
 */
export function defaultTasks(
  kind: ProjectKind,
  mode: TaskMode,
): Task[] {
  switch (kind) {
    case "deno":
      return mode === "check"
        ? [
          {
            stage: "fmt",
            cmd: "deno fmt --check",
            cwd: "",
            name: "deno-fmt-check",
          },
          { stage: "lint", cmd: "deno lint", cwd: "", name: "deno-lint" },
          { stage: "test", cmd: "deno test -A", cwd: "", name: "deno-test" },
        ]
        : [
          { stage: "fmt", cmd: "deno fmt", cwd: "", name: "deno-fmt" },
          {
            stage: "lint",
            cmd: "deno lint --fix",
            cwd: "",
            name: "deno-lint-fix",
          },
        ];
    case "rust":
      return mode === "check"
        ? [
          {
            stage: "fmt",
            cmd: "cargo fmt -- --check",
            cwd: "",
            name: "cargo-fmt-check",
          },
          { stage: "check", cmd: "cargo check", cwd: "", name: "cargo-check" },
          { stage: "test", cmd: "cargo test", cwd: "", name: "cargo-test" },
        ]
        : [
          { stage: "fmt", cmd: "cargo fmt", cwd: "", name: "cargo-fmt" },
          { stage: "lint", cmd: "cargo clippy", cwd: "", name: "cargo-clippy" },
        ];
    default:
      return [];
  }
}
import type { ProjectKind } from "@loru/devkit";

export type TaskMode = "check" | "fmt";
