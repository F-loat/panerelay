## Why

The Browser Use integration currently rejects every release except one exact Browser Use and Browser Harness pair and exposes Browser Harness as a separate user-managed prerequisite. Browser Harness is an internal runtime dependency of Browser Use, so Panerelay should present one Browser Use compatibility boundary while accepting compatible releases at or above the validated minimum.

## What Changes

- Treat Browser Use 0.13.7 as a minimum supported version instead of requiring exact equality.
- Continue checking Browser Use's internal Browser Harness runtime at a minimum of 0.1.8, but fold missing or incompatible runtime results into a single Browser Use installation check and remediation.
- Remove Browser Harness from user-facing setup, doctor, Skill, and package documentation; users install, upgrade, or repair Browser Use as one product.
- Keep Browser Use 0.13.7 with Browser Harness 0.1.8 as the exact verified compatibility baseline. Passing the minimum gate does not make a newer release verified.
- Update the durable Browser Use RFC and compatibility record to distinguish minimum eligibility from exact verified evidence.
- Keep the pinned agent-browser 0.33.0 integration and its browser-level CDP compatibility group unchanged.

Non-goals include changing the virtual CDP protocol, browser ownership, tab authorization, control leases, relay lifecycle, Browser Use SDK transparency, or upstream Browser Use code. Panerelay still controls only explicitly authorized tabs and fails closed outside that boundary.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `browser-use-connection-adapter`: Replace exact public Browser Use/Browser Harness version pairing with a minimum Browser Use boundary and one user-facing Browser Use installation status while preserving an internal runtime completeness check.

## Impact

This affects the `@panerelay/browser-use` compatibility helpers and adapter doctor output, setup lifecycle and doctor checks, CLI/i18n text, generated Browser Use Skill, public package documentation, RFC-0007, and the Browser Use compatibility record. It adds no external dependency and does not change agent-browser 0.33.0 behavior or any CDP, Bridge, Extension, Native Messaging, authorization, or cleanup interface.
