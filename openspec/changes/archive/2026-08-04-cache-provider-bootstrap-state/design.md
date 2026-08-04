## Context

`createInitialSidepanelState()` currently creates the complete supported catalog with every status set to `unavailable` and selects Codex. React renders that header immediately; only afterward does the controller read `panerelay.agentProvider`, request Extension status, and discover providers. The temporary red error state is invented by initialization rather than reported by the Native Host.

## Goals / Non-Goals

**Goals:**

- Preserve the last selected provider and most recent bounded provider presentation across Side Panel opens.
- Avoid rendering a false unavailable/disconnected state before live discovery.
- Keep live discovery authoritative and preserve existing fallback rules when readiness actually changes.

**Non-Goals:**

- Do not cache conversations, credentials, setup hints, provider-native payloads, approvals, or browser authorization.
- Do not enable composition, history, preparation, or provider switching from cached readiness alone.

## Decisions

### Preload cache before React mounts

The Side Panel entry point reads the existing preferred-provider key and a versioned provider cache before creating the React root. A blank root for the short storage read is preferable to painting a known-false provider error and then replacing it. The controller receives the validated bootstrap snapshot as its reducer initializer and still performs its normal live initialization immediately after mount.

Using `window.localStorage` was rejected because it would duplicate the existing Extension storage authority. Rendering the static catalog as `unavailable` was rejected because that status has a real user-facing meaning. Adding a public `unknown` provider status was rejected because the state is local boot presentation and does not require a shared protocol change.

### Cache minimal provider presentation only

The cache stores a schema version and entries for known provider IDs containing status plus bounded optional model/version labels. Names, descriptions, setup commands, capabilities, and hints continue to come from the checked-in catalog or live discovery. Unknown IDs, invalid statuses, relative structures, and oversized strings are ignored.

The saved provider ID remains the canonical preference. During boot, it is preserved when it names a supported cached provider even if the cache is stale; after live discovery, existing ready-provider fallback rules apply.

### Keep actions gated on live initialization

The header may show the cached provider identity and bounded model/version labels, but connection copy remains neutral `connecting` for the entire `initializing` interval. This prevents cached readiness from producing `connected → connecting → connected` while live provider discovery and preparation run. `initializing` continues to disable provider selection, new conversation, history, and composition until Extension status, live provider discovery, and workspace restoration complete.

Every successful live discovery replaces the cache best-effort. Cache write failure does not fail provider discovery or show a global error.

## Risks / Trade-offs

- [Cached ready status is stale] → It is presentation-only for provider ordering and labels during a short initialization window; connection copy stays neutral, actions remain disabled, and live discovery replaces it.
- [Storage read is slow or fails] → Mount with an empty validated bootstrap after failure and retain neutral initializing presentation.
- [Provider support changes across versions] → Version the cache and accept only current catalog IDs.
- [Live provider becomes unavailable] → Apply the live result and existing fallback rules even when that produces one legitimate visible change.

## Migration Plan

1. Add cache serialization/validation and optional reducer bootstrap input.
2. Preload bootstrap storage before mounting the production Side Panel.
3. Refresh the cache after successful discovery and preparation refresh.
4. Older installs have no cache and use neutral initialization until the first successful discovery.
5. Rollback ignores the versioned cache key; no state migration is required.
