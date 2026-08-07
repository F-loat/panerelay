## Why

Panerelay site adapters currently require the extra `fetch` namespace even though their command model already follows OpenCLI's site-first shape. Supporting `panerelay <site> <command>` makes common adapter calls shorter and more familiar while retaining the explicit fetch form for compatibility and disambiguation.

## What Changes

- Accept an installed site adapter ID as a top-level command alias for `panerelay fetch <site> ...`.
- Keep built-in Panerelay commands and global metadata options higher priority than site aliases.
- Preserve the explicit `panerelay fetch` form, including as the escape hatch when a site ID conflicts with a built-in command.
- Show the direct form in localized CLI and adapter help while documenting both accepted forms.
- Preserve existing browser selection, fetch authorization, adapter isolation, and error behavior after routing.
- Non-goals: direct raw-URL fetch aliases, adapter auto-installation, new site permissions, browser ownership changes, or changes to the agent-browser 0.33.0 compatibility baseline.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `fetch-site-adapters`: Add direct top-level routing and help behavior for installed site adapters.
- `panerelay-cli`: Define precedence and fallback behavior between built-in commands and direct site aliases.

## Impact

- Affects `@panerelay/cli` argument routing, localized help, and CLI tests.
- May update built-in adapter examples and user documentation to present the shorter form.
- Does not change the adapter protocol, Bridge, Extension, setup storage, browser control leases, domain policy, or automation-engine integration behavior.
