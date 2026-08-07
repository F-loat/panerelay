## Context

See `proposal.md` for motivation. The synchronous CLI parser currently recognizes only fixed top-level commands, while installed fetch adapter IDs live in a protected asynchronous registry. Fetch already owns adapter help, argument validation, browser selection, process isolation, and output, so direct invocation should reuse that path instead of adding a second dispatcher. RFC-0009 remains authoritative for fetch permissions and process boundaries.

## Goals / Non-Goals

**Goals:**

- Resolve an exact installed site ID before fixed-command parsing rejects it.
- Preserve the original adapter argument vector and existing global-versus-command option rules.
- Keep fixed top-level commands deterministic and independent from adapter installation state.

**Non-Goals:**

- Making the parser or adapter manifest API async.
- Treating every unknown token or a URL as fetch input.
- Changing adapter installation, browser authorization, control, or compatibility classification.

## Decisions

### Rewrite a confirmed alias into the existing fetch form

Before normal parsing, the CLI will identify the first command operand while accounting for global `--lang`. If it is not a fixed top-level command, the CLI will read the protected fetch-adapter registry. An exact installed ID is rewritten in memory from `panerelay <site> ...` to `panerelay fetch <site> ...`, after which the existing parser and fetch command run unchanged.

This keeps one implementation of adapter behavior and makes explicit and direct forms equivalent. A universal unknown-command fallback was rejected because typos and intentionally unsupported commands such as `panerelay setup` would acquire different errors. Making `parseCliArgs` asynchronous was rejected because it would couple a reusable syntax parser to protected user state.

### Fixed commands and metadata options win

`browsers`, `browser`, `connection`, `fetch`, and `run` remain fixed commands. Global version requests are handled before alias lookup, and global help remains unchanged unless the first command operand resolves to an installed site. A colliding adapter remains reachable through the explicit fetch form.

### Read only adapter metadata during alias resolution

Alias resolution uses the existing protected registry reader without selecting a browser or reading Bridge state. Executable integrity remains verified later by the existing adapter execution path. Registry validation errors fail closed.

## Risks / Trade-offs

- [One additional registry read for direct site invocations] → Restrict lookup to non-built-in command candidates; explicit commands incur no extra read.
- [Future built-in command shadows an adapter ID] → Define built-in precedence and retain the explicit fetch escape hatch.
- [Global and site `--lang` are position-sensitive] → Rewrite before the existing language parser and add direct-form regression coverage for both positions.

## Migration Plan

Ship the alias as additive CLI behavior, update help and built-in examples to prefer it, and retain every explicit fetch form. Rollback removes the pre-parse rewrite without requiring registry or adapter migration.
