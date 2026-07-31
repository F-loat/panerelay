## Context

See `proposal.md` for motivation and the change specs for observable behavior. The current Manifest V3 Extension, side panel, `chrome.debugger` relay, and Native Messaging manifest are Chromium-compatible, but runtime registration and setup assume Chrome. RFC-0001 through RFC-0004 keep site permission, tab authorization, observation, control, target identity, and revocation independent from browser focus or installation.

## Goals / Non-Goals

**Goals:**

- Reuse one Chromium Extension graph and CDP implementation for Chrome and Edge.
- Make Edge identity and required CDP transport explicit before any automation lease is created.
- Install the existing identity-scoped Native Host in Edge's per-user discovery locations.
- Keep the agent-browser 0.33.0 command groups `Forwarded` for Edge until real-runtime evidence exists.

**Non-Goals:**

- Add browser-family behavior to the shared automation protocol beyond connection metadata.
- Add Firefox manifests, Gecko identities, WebDriver, browser launchers, or a second automation transport.
- Create an Edge-only Extension artifact or claim Microsoft Edge Add-ons publication.
- Reclassify any Edge group as `Verified` without a retained real-browser run.

## Decisions

### Add optional browser family and CDP capability fields

`browser.register` will add optional `browserFamily` and `capabilities.cdpRelay` fields. New Extension builds send both. The Bridge stores them in ephemeral state and rejects session creation before allocating participant, lease, WebSocket, or activity state when `cdpRelay` is explicitly false. The agent-browser adapter may produce an earlier diagnostic, but the Bridge repeats the authoritative policy check.

Absent capabilities retain the already accepted Chrome behavior for compatibility with older same-protocol Extension builds. A browser name never overrides an explicit negative capability. This decision is recorded durably in RFC-0005.

Alternatives considered:

- Inferring capability solely from the user agent was rejected because a presentation identity does not prove a required API exists.
- Waiting for the first CDP command to fail was rejected because it creates misleading credentials and control state.

### Keep Edge on the existing Chromium Extension graph

The runtime uses available browser metadata to distinguish Edge, then feature-detects `chrome.debugger` before declaring CDP support. Edge retains the existing `manifest.json`, service worker, `side_panel`, optional host permissions, public key, package command, and release archive.

Splitting Edge into its own source graph or archive was rejected because it would duplicate code without a different API boundary. Firefox-specific graph separation is intentionally outside this change.

### Extend Chromium Native Messaging discovery

The installer writes the same `allowed_origins` manifest to Edge's documented per-user locations on macOS and Linux. On Windows it writes one managed manifest and registers its absolute path beneath exact current-user Google Chrome and Microsoft Edge keys. Doctor reports each Windows registry key independently; update and uninstall replace or remove only those managed entries.

Using a browser-neutral discovery directory was rejected because Native Messaging discovery paths and registry keys are browser-owned. An Edge-specific Extension identity is not added because this change uses the same Chromium build; existing custom-ID precedence remains available.

### Keep compatibility evidence scoped

Chrome plus agent-browser 0.33.0 retains its existing `Verified` matrix. Edge reuses the same protocol and CDP implementation, but its command groups are `Forwarded` until an installed Edge runtime completes the representative acceptance path. Browser-process ownership features remain `Unsupported`.

## Risks / Trade-offs

- [Edge may diverge from Chrome on a forwarded CDP method] → Keep Edge claims `Forwarded`, add runtime identity tests, and require a real-Edge acceptance run before `Verified`.
- [One broken Edge registry key could make doctor look globally unhealthy] → Report Chrome and Edge registration checks independently with browser-specific repair guidance.
- [Chrome Web Store availability in Edge can vary by policy] → Keep the normal Store-first path while documenting matching unpacked builds for development and policy-constrained installations.
- [Optional registration fields could be mistaken for authorization] → Keep permission and lease checks unchanged and document that capabilities are transport metadata only.

## Migration Plan

1. Extend protocol, Extension registration, Bridge state, and the pre-session capability gate compatibly.
2. Add Edge Native Messaging paths, Windows registration lifecycle, and per-browser doctor checks.
3. Update setup, README, release guidance, compatibility documentation, RFC-0005, and package tests.
4. Run the full workspace and packed-release validation; record Edge only as `Forwarded` unless a real Edge run is available.

Rollback removes the optional metadata and Edge discovery entries. Older Chrome registrations continue working throughout; no persisted lease or target migration is required.
