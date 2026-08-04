## Why

The Side Panel renders the static catalog before it asynchronously reads the saved provider and discovers live provider readiness. Every open can therefore flash `Codex unavailable` even when the user selected Qoder and the Native Host previously reported it ready.

## What Changes

- Persist a versioned, presentation-only cache of the supported provider statuses already returned to the Extension.
- Load the saved provider ID and cached statuses before the first React render.
- Render the cached provider identity and bounded labels with neutral connecting status while live Native Host discovery and provider preparation run; Agent actions remain disabled during initialization.
- Replace the cache with each successful live discovery and ignore malformed or unknown cached entries.
- Show one neutral connecting state throughout initialization instead of a false disconnected, unavailable, or premature connected state.

Non-goals:

- Cached readiness does not authorize Agent actions, start a provider, bypass live discovery, persist provider-native configuration, or suppress a real status change.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `agent-provider-preparation`: the Side Panel bootstraps provider presentation from a bounded cache while live discovery remains authoritative for actions and preparation.

## Impact

- Extension Side Panel bootstrap, provider selection, storage, and component tests.
- One versioned `chrome.storage.local` cache key containing provider presentation data already visible to the Extension.
- No Bridge, shared protocol, browser permission, provider process, or compatibility-matrix change.
