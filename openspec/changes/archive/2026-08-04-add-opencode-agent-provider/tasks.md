## 1. Shared ACP Provider Core

- [x] 1.1 Extract a private profile-driven ACP runtime/provider core while preserving Qoder's existing public test seams and fixed launch behavior.
- [x] 1.2 Preserve listed and created ACP session working directories for load/resume and add focused directory, capability, timeout, permission, and exit-cleanup tests.
- [x] 1.3 Run the complete Qoder provider and Bridge AgentService regression suites against the shared core.

## 2. OpenCode Runtime and Provider

- [x] 2.1 Add cross-platform OpenCode executable candidate discovery, version probing, explicit override handling, and unit tests for PATH, user-local, configured, missing, and wrapper cases.
- [x] 2.2 Add the closed OpenCode ACP provider profile and wrapper with fixed `opencode acp` launch, targeted setup metadata, capability negotiation, and AgentService registration.
- [x] 2.3 Add provider tests for listing, start/load/resume, text and reasoning streaming, tools and usage, images, permissions, interruption, unknown updates, subprocess exit, and no injected browser integration.

## 3. Setup, Doctor, and Side Panel

- [x] 3.1 Persist and read protected `opencodePath` and `opencodeVersion` runtime configuration, including `PANERELAY_OPENCODE_PATH`, setup installation results, and Host tests.
- [x] 3.2 Add optional OpenCode setup/doctor checks and localized CLI output without changing core installation health when it is absent.
- [x] 3.3 Add OpenCode to the Side Panel provider catalog with localized setup guidance, install/auth/documentation metadata, and provider-selection/controller tests.
- [x] 3.4 Group the Side Panel provider selector with ready providers first while preserving stable catalog order within each availability group.
- [x] 3.5 Add a manual, deduplicated provider rediscovery action to unavailable setup cards without reloading workspaces, conversations, or browser authorization.

## 4. Distribution and Compatibility Evidence

- [x] 4.1 Extend package, setup, README, and release/packed-artifact assertions so the shipped provider registry and optional OpenCode diagnostics are covered on macOS, Linux, and Windows.
- [x] 4.2 Run a temporary-project OpenCode 1.18.12 ACP probe covering initialization, list/new/load, prompt streaming, image capability, permission response, interruption, and clean process shutdown without browser-tool injection.
- [x] 4.3 Record OpenCode 1.18.12 capability classifications and limitations in `docs/compatibility/`, including any unavailable real-runtime evidence as `Forwarded`, `Partial`, or `Unsupported` rather than inferred `Verified`.
- [x] 4.4 Run the existing agent-browser 0.33.0 daily-Chrome shared-Bridge regression or record the still-pending runtime gate without changing its established compatibility classification.

## 5. Validation and Cleanup

- [x] 5.1 Run OpenSpec strict validation, package-scoped formatting/typechecks/tests, and relevant setup, Extension, Bridge, and packed-consumer checks.
- [x] 5.2 Run `pnpm install --frozen-lockfile`, `pnpm run check`, and `git diff --check`; remove temporary runtimes, profiles, logs, screenshots, and probe state without committing machine-specific output.
