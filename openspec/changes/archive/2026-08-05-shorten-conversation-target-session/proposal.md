## Why

Side Panel conversations currently inject a 90-character agent-browser session name built from two canonical UUIDs. agent-browser 0.33.0 accepts session names only up to 64 characters for browser work, so the exact target hint fails before the Panerelay Provider can bind the originating page and Agents fall back to an ordinary short session without deterministic `t1` orientation.

## What Changes

- Replace the textual UUID-pair session format with a compact, versioned, canonical base64url encoding that remains reversibly bound to the same opaque browser and target UUIDs.
- Keep every generated conversation-target session below agent-browser 0.33.0's 64-character limit and valid for its session-name character set.
- Parse only the new complete canonical format; reject malformed or non-canonical values and stop recognizing the unusable overlong v1 format.
- Use the compact value consistently in agent-browser and Playwright Side Panel guidance and target-scoped gateway metadata.
- Correct the accepted RFCs, package guidance, and version-specific compatibility records that currently document the overlong value.
- Preserve authorization, target ordering, control ownership, browser-process limitations, and ordinary user-selected session behavior unchanged.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `agent-browser-advanced-commands`: Require generated exact-target sessions to satisfy the pinned agent-browser session-name contract while retaining fail-closed browser/target binding.
- `playwright-cdp-connection`: Require the shared derived Side Panel session value to use the compact canonical target encoding.

## Impact

- Shared protocol helper and tests for conversation-target session encoding.
- Panerelay agent-browser Provider parsing and Bridge context/gateway tests.
- Agent-facing package documentation and prompt expectations.
- RFC-0002 and RFC-0007 session-format decisions.
- agent-browser 0.33.0 and Playwright CLI 0.1.17 compatibility records.
- No dependency, browser ownership, permission, control lease, or public network protocol expansion.
