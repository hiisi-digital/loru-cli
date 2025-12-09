# Loru CLI

`loru` is a lightweight CLI to manage Loru projects (plugins, pages/tenants, platform components).

Goals:
- Unified `loru.toml` config (supports multiple plugins/pages).
- Schema fetch + validation with semver ranges and caching.
- Project-aware checks (Deno/Rust) without per-repo Justfile boilerplate.
- Shared utilities (version bump, BOM fetch) via subcommands.

## Install (Deno)

Run from a clone of this repository (imports resolve from GitHub, no sibling repos needed):

```bash
deno install -A -f -n loru --config=deno.json main.ts
```

## Config: `loru.toml`

Minimal example:
```toml
[meta]
schema_version = "0.3.2"   # default for entries without override

[[plugin]]
id = "my-plugin"
name = "My Plugin"
path = "."
entrypoint = "mod.ts"
schema_version = "0.3.2"

[[page]]
id = "my-tenant"
name = "My Tenant"
path = "."
entrypoint = "main.ts"
schema_version = "0.3.2"
domains = ["example.com"]
locales = ["en", "fi"]
```

Lookup:
- Searches `loru.toml` in cwd, then `.loru/loru.toml`, then climbs parents.
- If no config, per-entry metadata files (`plugin.toml` / `tenant.toml`) are still honored for schema version when validating.

## Commands

```bash
loru run <task>             # run tasks from loru.toml (workspace-aware)
loru dev schemas fetch|validate
loru dev check              # schema validate + Deno/Rust checks where applicable
loru dev build              # phased build hooks + project build (deno/cargo)
loru dev init githooks      # install conventional commit + pre-push hooks for workspace
loru dev init buildsys      # centralize locks/caches under .loru
loru dev bump --level=patch|minor|major   # per-entry bump/tag/release
loru dev bom fetch          # fetch platform BOM (from loru-devkit)
```

## Behavior
- **Schema fetch/validate**: semver-aware fetcher (tags in `loru-schemas`), caches under `.loru/cache/schemas`. Validation uses Taplo against `loru.toml`.
- **Checks**: Runs fmt/lint defaults for detected Deno/Rust projects, then executes per-stage `[[check.task]]` hooks (precheck/fmt/lint/check/test/postcheck) across workspace members/targets.
- **Build**: Executes declared `[[build.task]]` phases and then builds detected Deno/Rust projects.
- **Workspace aware**: All dev commands and `loru run` walk workspace members.

## TODO / next steps
- Add CLI release workflow (tags).
- Expose compatibility checks using BOM and schema ranges.
- Add more subcommands as the platform surface grows.
