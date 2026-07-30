## Why

Panerelay's Extension already supports Chinese and English, but the repository entry point and setup CLI are English-only. Chinese users should be able to evaluate, install, diagnose, and remove Panerelay without translating the primary documentation or interactive output themselves.

## What Changes

- Add a complete Simplified Chinese root README with an explicit language switch from both README variants.
- Localize human-readable setup CLI help, validation errors, setup and uninstall results, confirmation prompts, and doctor output in English and Simplified Chinese.
- Select the default CLI language from the device locale, with explicit `--lang` and `PANERELAY_LANG` overrides.
- Keep `doctor --json` structurally and textually stable for scripts and Agents.

Non-goals:

- Do not translate RFCs, OpenSpec records, compatibility matrices, package APIs, logs, protocol payloads, paths, commands, or product identifiers.
- Do not persist a language preference or add more than English and Simplified Chinese.
- Do not localize errors originating from the operating system or third-party executables when no stable Panerelay error classification exists.

## Capabilities

### New Capabilities

- `setup-cli-localization`: Defines bilingual setup CLI selection, overrides, fallback behavior, and machine-readable output stability.

### Modified Capabilities

None.

## Impact

- Root and setup package documentation.
- `@panerelay/setup` argument parsing and human-readable output.
- Setup package tests and packaged `dist` output.
- No protocol, browser permission, control-session, or Extension behavior changes.
