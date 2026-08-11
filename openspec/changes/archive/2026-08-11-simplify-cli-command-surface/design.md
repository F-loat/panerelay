## Context

See `proposal.md` for motivation. The public CLI still parses three entry points that are outside every supported normal workflow. RFC-0007 already directs Browser Use users to invoke the upstream command through Setup's fixed `BU_CDP_URL`; agent-browser uses its Provider, and Playwright uses explicit CDP attach. The Extension and Bridge independently use browser-default clearing and adapter preference APIs, so removing CLI commands must not remove those internal capabilities.

## Goals / Non-Goals

**Goals:**

- Make the executable reject the three unused commands and stop advertising them.
- Remove process-wrapper and concurrency-lock code that has no caller after `run` is removed.
- Preserve internal registry, browser-default, adapter-resolution, and mode-preference APIs needed by installed integrations and their contract tests.
- Keep RFC-0007 and the main OpenSpec contracts aligned with the supported direct-engine workflows.
- Make current Agent Skill guidance consistently use the global CLI that base Setup provides.

**Non-Goals:**

- Redesign the setup-managed adapter registry or bounded adapter protocol.
- Change the Browser Use gateway, Playwright attach endpoints, agent-browser 0.33.0 Provider, or their compatibility classifications.
- Change authorization, revocation, target lifecycle, control leases, or browser-process ownership.

## Decisions

### Remove executable surfaces without removing shared internal capabilities

The CLI parser, operation types, dispatch branches, localized errors, and help will stop recognizing `browser clear`, `connection resolve`, and `run`. The top-level built-in-name set will also drop `run`, allowing an installed site adapter with that ID to use the direct alias like any other adapter.

The browser registry's clear API stays because the Extension settings surface calls it. The bounded connection resolver and adapter protocol stay as package-level integration machinery because setup-registered Browser Use and Playwright adapters, registry integrity coverage, and cross-package contract tests still use that boundary even though humans no longer invoke it directly.

Alternative considered: remove the full connection-adapter protocol. Rejected for this change because it would conflate a command-surface cleanup with a cross-package integration redesign and would require replacing setup registration and integration-health contracts.

### Delete the `run`-only wrapper and lock modules

The child runner, signal forwarding, scoped environment injection, and CLI adapter concurrency lock have no production caller after removing `run`; their exports and tests will be deleted. Browser Use concurrency remains governed by the fixed gateway and persistent Browser Harness lane documented in RFC-0007, not by this wrapper lock.

Alternative considered: keep the modules as unused exports. Rejected because there are no legacy consumers to preserve and unused process-launching code expands the public API and maintenance surface.

### Make top-level help setup-first

The bilingual help will combine syntax and descriptions into a compact common-usage section, then show base Setup and `setup add` examples. Detailed low-frequency lifecycle and integration commands remain in setup/package documentation where they have context.

The published Panerelay Skill will likewise use the Setup-provided `panerelay` executable for recurring browser and connection administration. `npx` remains appropriate for one-time Setup and independent Agent Skill lifecycle operations, but `npx @panerelay/cli` is no longer a documented fallback.

## Risks / Trade-offs

- **Risk: Internal clearing is accidentally removed with the CLI command.** → Keep `clearBrowserDefault` in `@panerelay/browser-registry` and retain Bridge/Extension tests.
- **Risk: Removing the runner is mistaken for changing Browser Use concurrency behavior.** → Update RFC-0007 to identify the fixed gateway as the canonical path and retain Browser Use 0.13.7 / Browser Harness 0.1.8 compatibility tests.
- **Risk: Main specs still require removed commands.** → Sync delta specs and remove stale `run` metadata scenarios before archiving.

## Migration Plan

No legacy-user migration is required. Documentation maps the removed operations to supported paths: use Extension settings to clear the current browser default, invoke Browser Use directly after Setup, and use the normal agent-browser Provider or Playwright attach commands. Rollback is a normal source revert before the next lockstep release.
