## Why

The common Panerelay Browser Use invocation repeats the adapter name and the upstream executable even though setup already records the exact executable. This makes the supported workflow feel more complicated than necessary and encourages users to copy the generic adapter form.

## What Changes

- Rename the setup-managed launcher to `panerelay-browser-use`.
- Make the dedicated launcher start the configured Browser Use executable through the existing internal adapter dispatch when invoked with no arguments.
- Remove `run browser-use` from the documented and dedicated-launcher user workflow.
- Keep `connection use` for durable Direct/Extension mode selection and keep browser selection in the unified `panerelay browser ...` commands.
- Update the installed Skill and user-facing documentation to use the shorter launcher form for the common case.
- Add coverage for POSIX and Windows launcher behavior, the renamed path, and the no-argument default path.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `browser-use-connection-adapter`: the setup-managed Browser Use launcher becomes a dedicated no-argument entry point while retaining the existing adapter and security boundaries.

## Impact

- Affected setup launcher generation, Browser Use Skill templates, documentation, and setup tests.
- No upstream Browser Use dependency, protocol identifier, CDP behavior, or authorization policy changes.
- The generic `@panerelay/cli` remains engine-neutral; only the setup-managed Browser Use launcher knows its configured executable.
