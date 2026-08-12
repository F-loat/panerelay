## Why

Panerelay's Side Panel lets users choose an accent color, but the project website always uses its fixed green palette. Letting the official website opt into the local Extension appearance makes the product feel continuous without turning presentation synchronization into browser authorization.

## What Changes

- Let an explicitly allowlisted Panerelay website origin request the Extension's current accent palette through a narrow read-only external message.
- Keep already-open official website pages synchronized when the Extension accent color changes.
- Apply the received palette to the website's existing CSS custom properties and retain the checked-in website palette whenever the Extension is absent, unsupported, or rejects the request.
- Validate external senders and message shapes in the Extension and expose no other stored settings, browser state, or Agent state.
- Record the website-to-Extension presentation boundary in RFC-0001.
- Non-goals: synchronizing arbitrary sites, granting site permission or tab authorization, acquiring a control lease, synchronizing through the Bridge or a cloud service, or adding a light website theme.

## Capabilities

### New Capabilities

- `website-appearance-sync`: Bounded, fail-safe accent-palette synchronization between an allowlisted official website and the local Extension.

### Modified Capabilities

None.

## Impact

- Extension: Manifest V3 external-connectability declaration, a read-only background message handler, accent-change publication, and unit coverage.
- Website: an optional Extension client, CSS-variable application, lifecycle cleanup, and unit coverage.
- Architecture: RFC-0001 gains an amendment describing the official-site appearance channel and its separation from site permission, tab authorization, Agent sessions, and control ownership.
- Compatibility: agent-browser 0.33.0 remains pinned; the existing connection, page-automation, target/state, diagnostics/network/emulation, Provider-option, and control-session-activity groups are unaffected.
