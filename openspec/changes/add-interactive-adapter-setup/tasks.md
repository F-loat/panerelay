## Implementation

- [x] Add the interactive selection/default model to setup CLI parsing and dependency-injected prompts.
- [x] Thread the Browser Use initial default mode through lifecycle and adapter installation while preserving explicit setup behavior.
- [x] Add bilingual prompt, completion, and help messaging.

## Tests and verification

- [x] Add CLI tests for TTY interactive selections, both engines, defaults, declined defaults, explicit flags, and non-TTY/`--yes` behavior.
- [x] Add lifecycle/integration tests proving Browser Use direct versus Extension preference writes and no daemon startup.
- [x] Run package tests, `pnpm install --frozen-lockfile`, `pnpm run check`, and `git diff --check`.
- [x] Verify the setup flow through TTY-equivalent dependency-injected CLI coverage and record compatibility/ownership limitations without committing machine-specific output.
- [x] Confirm that no version-dependent compatibility claim changed; no compatibility-documentation update is required.
