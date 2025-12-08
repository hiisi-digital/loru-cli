# Loru CLI

`loru` is a lightweight CLI to manage Loru projects (plugins, pages/tenants, platform components).

Goals:
- Unified `loru.toml` config (supports multiple plugins/pages).
- Schema fetch + validation with semver ranges and caching.
- Project-aware checks (Deno/Rust) without per-repo Justfile boilerplate.
- Shared utilities (version bump, BOM fetch) via subcommands.

## Install (Deno)

```bash
deno install -A -f -n loru https://raw.githubusercontent.com/hiisi-digital/loru-cli/main/main.ts
```

## Config: `loru.toml`

Minimal example:
```toml
[meta]
schema_version = "0.1.0"   # default for entries without override

[[plugin]]
id = "my-plugin"
name = "My Plugin"
path = "."
entrypoint = "mod.ts"
schema_version = "0.1.0"

[[page]]
id = "my-tenant"
name = "My Tenant"
path = "."
entrypoint = "main.ts"
schema_version = "0.1.0"
domains = ["example.com"]
locales = ["en", "fi"]
```

Lookup:
- Searches `loru.toml` in cwd, then `.loru/loru.toml`, then climbs parents.
- If no config, per-entry metadata files (`plugin.toml` / `tenant.toml`) are still honored for schema version when validating.

## Commands (early draft)

```bash
loru dev schemas fetch      # fetch+cache schemas for all entries (plugins/pages)
loru dev schemas validate   # fetch+cache then Taplo lint metadata (plugin/tenant or loru.toml)
loru dev check              # schema validate + Deno/Rust checks where applicable
loru dev bump-version --level=patch|minor|major --file=deno.json
loru dev bom fetch          # fetch platform BOM (from loru-devkit)
```

## Behavior
- **Schema fetch**: uses `loru-devkit` semver-aware fetcher (tags in `loru-schemas`), caches under `.loru/cache/schemas`.
- **Schema validate**: Taplo fmt/lint against fetched schema for each metadata file found (`plugin.toml`, `tenant.toml`, or `loru.toml` as fallback).
- **Checks**: For each entry `path`, if `deno.json*` exists run `deno fmt --check && deno lint`; if `Cargo.toml` exists run `cargo fmt --check && cargo check` (optional clippy can be added later).

## TODO / next steps
- Add CLI release workflow (tags).
- Expose compatibility checks using BOM and schema ranges.
- Add more subcommands as the platform surface grows.
