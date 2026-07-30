## Why

Panerelay's alpha browser relay, setup flow, agent-browser integration, and Codex side panel are ready to graduate into the first stable `0.1.0` release. Stable release preparation must replace alpha-only platform and Agent gaps with supported Windows Native Messaging and a second Qoder CLI adapter, while presenting compatibility and architectural boundaries accurately.

## What Changes

- Establish one lockstep stable `0.1.0` identity for the Extension and four publishable `@panerelay` packages, and produce a non-publishing stable release candidate.
- Retain the Extension manifest's public `key` so unpacked and packaged builds resolve to the official Extension ID `panplnkjlkoceaonlmpdekjphgmbggmi`, and validate that Native Messaging origins use the same identity by default.
- Let users configure one custom Chrome Extension ID for a custom or rebranded build; validate and persist the effective ID so setup, update, doctor, Bridge registration, and Native Messaging `allowed_origins` remain aligned.
- Support per-user Chrome Native Messaging installation, diagnosis, update, and uninstall on Windows in addition to macOS and Linux.
- Add a provider-neutral Qoder CLI adapter over Agent Client Protocol (ACP), including discovery, setup guidance, conversation start/resume/list, streaming, interruption, tool activity, and permission responses supported by the installed Qoder runtime.
- Make side-panel Agent discovery and selection genuinely dynamic so Codex and Qoder can coexist without either provider becoming an authorization shortcut.
- Document `agent-browser` 0.33.0 as the minimum supported version and explain explicit, project, and user-level Provider selection. Keep 0.33.0 as the version-specific verified evidence baseline rather than implying that users must pin exactly that version.
- Replace the catch-all "Alpha limitations" list with stable compatibility and architecture guidance: daily-Chrome browser-process ownership remains an inherent boundary, memory-bounded activity is a privacy design, and lockstep versions are a distribution rule.
- Extend release checks and operator guidance for the stable version, Windows artifacts, Qoder runtime packaging, minimum-version checks, upgrade/rollback, and reproducible acceptance evidence.

Non-goals:

- Do not add isolated browser contexts, proxy or executable launch control, profile replay, browser-wide close, top-level request containment, or other browser-process ownership that a Chrome Extension cannot honestly provide.
- Do not add concurrent mutation owners, automatic side-panel/external-Agent control handoff, or persistent prompt, page-content, or activity history.
- Do not publish npm packages, create a GitHub release, upload to Chrome Web Store, or push a tag as part of preparation or CI.
- Do not claim compatibility for every future agent-browser or Qoder CLI version without capability negotiation and representative evidence.

## Capabilities

### New Capabilities

- `stable-distribution`: Defines the lockstep `0.1.0` candidate, stable documentation, minimum dependency policy, cross-platform release checks, and explicit non-publishing release gates.
- `windows-native-messaging`: Defines safe per-user Windows Native Messaging installation, registry registration, diagnosis, update, rollback, and cleanup.
- `qoder-agent-provider`: Defines Qoder CLI discovery and ACP-backed provider behavior through the existing provider-neutral conversation protocol.

### Modified Capabilities

- `agent-browser-advanced-commands`: Changes the public compatibility contract from an exact 0.33.0 pin to a minimum supported agent-browser version of 0.33.0 while retaining version-specific evidence and explicit browser-ownership limitations.

## Impact

- Release metadata, package manifests, Extension manifest, candidate tooling, CI matrices, and release documentation move from `0.1.0-alpha.1` to stable `0.1.0`.
- Release validation derives the Extension ID from the manifest public key and rejects drift from the checked official ID; no private signing key is stored or packaged.
- Setup gains an explicit custom Extension ID option and environment override while preserving the official ID as the default and rejecting malformed IDs before writing installation state.
- Setup and Bridge installation gain Windows path, launcher, registry, doctor, update, and uninstall behavior, following Mearl's proven per-user registration shape without importing its product-specific services.
- Bridge Agent services gain a provider registry and Qoder ACP adapter; runtime configuration and setup diagnostics gain Qoder executable discovery.
- The Extension side panel and shared protocol normalization gain multi-provider selection and Qoder permission/tool event presentation without exposing provider-native wire objects.
- `@agentclientprotocol/sdk` becomes a Bridge runtime dependency; Qoder CLI remains an external user-installed runtime.
- RFC-0001 and compatibility documentation receive implementation/evidence updates. RFC-0002's ownership and fail-closed decisions remain unchanged.
