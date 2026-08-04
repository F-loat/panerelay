## Context

See [proposal.md](./proposal.md) for motivation and the delta specs for observable behavior. RFC-0002 currently makes Extension-generated target IDs opaque while agent-browser assigns its own `t1` handles from discovery order. RFC-0007 adds Browser Use and Playwright CDP gateways but deliberately preserves their upstream lifecycle: Browser Harness uses one persistent shared daemon lane, while Playwright CLI uses explicit attach and session-local numeric tab indexes.

Pinned source inspection establishes three different upstream inputs:

- agent-browser 0.33.0 accepts `--session`, passes that name to the Panerelay Provider, and assigns `t1`, `t2`, and later handles from initial discovery rather than accepting a CDP target ID at its CLI boundary;
- Browser Harness 0.1.8 reads `BU_NAME` for its daemon lane and its public `switch_tab(targetId)` helper accepts the exact CDP `targetId` returned by `list_tabs()`;
- Playwright CLI 0.1.17 accepts `-s=<session>`, but `tab-select` accepts only a current array index and `tab-list` does not expose a CDP target ID.

The Extension already generates random UUID target IDs and maps them privately to raw Chrome tab IDs. The same target IDs are presented through virtual CDP and are not credentials. The Extension also owns a random opaque browser registration UUID. Neither identifier authorizes a site or grants browser control.

The sibling `fix-acp-prompt-lifecycle-privacy` change introduces the exact `<panerelay-context version="1">` envelope for ACP prompts. Target hints must ship after or with that normalization so ACP history does not present Panerelay-authored locating data as user text.

## Goals / Non-Goals

**Goals:**

- Make a new Side Panel conversation able to name the exact originating Extension target across the three pinned engine interfaces.
- Make the unified Skill select one engine for an ordinary task without enumerating every supported executable or asking the user to make an unsolicited engine choice.
- Keep target resolution inside the originating live browser registration and the participant's existing authorization boundary.
- Preserve ordinary tab listing, creation, selection, controlled-lineage discovery, revocation, and control behavior after orientation.
- Produce an early and distinguishable target-unavailable failure instead of a valid handle for another tab.

**Non-Goals:**

- Do not make target hints durable across Extension service-worker identity loss, browser generation replacement, tab closure, or authorization changes.
- Do not retrofit target hints into already-created provider conversations.
- Do not give Browser Use per-conversation daemon isolation or change its shared current-page semantics.
- Do not add raw-CDP lookup commands to Playwright CLI, infer target identity from URL/title, or modify external packages.

## Decisions

### Add a browser-plus-target hint to conversation page context

`ConversationPageContext` gains an optional `target` object containing `browserId` and `targetId`. The Extension fills it for the active tab using its existing browser registration UUID and `targetIdForTabId()` value. Both values are validated as canonical UUID strings at the Extension/Host protocol boundary and bounded again by the Bridge. The hint is retained even when URL or title is unavailable, while invalid or partial hints are omitted as a unit.

Using the existing opaque IDs keeps the raw Chrome tab ID Extension-private and avoids a second target identity map. A target-only hint was rejected because the agent-browser Provider and Playwright gateway must select the correct live browser before they can resolve a target in multi-browser installations. A URL/title-only hint was rejected because duplicate pages and navigation make it ambiguous.

The context renderer derives a reserved session string:

```text
panerelay-tab-v1-<browser-uuid>-<target-uuid>
```

The fixed UUID lengths keep the string below the upstream 128-character session-label bound and make parsing exact without accepting arbitrary delimiter variants. The renderer also derives a target-scoped Playwright gateway URL. These values are emitted as Panerelay locating instructions inside the provider's existing system/developer context path; ACP text uses the sibling change's v1 context envelope. The IDs and URL are explicitly described as staleable and non-authorizing.

### Select one automation engine before readiness checks

The unified Skill resolves one engine for an ordinary browser task in this order: an engine explicitly named by the user; a trusted Panerelay registered default; registered agent-browser; registered Browser Use; registered Playwright CLI; and agent-browser when no trusted setup registration exists. A user-named engine always wins. When multiple default-capable integrations are registered, agent-browser wins the tie because it is the general-purpose CLI/MCP recommendation and already precedes Browser Use in the established fallback order.

After selection, the Skill inspects, invokes, sets up, and diagnoses only that engine. A missing executable produces that engine's targeted official installation path rather than probes for the two alternatives or a question asking the user to choose among implementation technologies. A failed or stale registered integration also remains selected for the smallest repair; the Skill does not silently change engines.

Listing all supported engines before selection was rejected because Agents interpret a compatibility inventory as a required user choice and perform redundant version probes. Selecting whichever executable happens to appear first on `PATH` was rejected because it ignores Panerelay's explicit defaults and makes behavior environment-order dependent. Removing the other integrations from the Skill entirely was rejected because explicit user requests and configured defaults must remain supported.

### Bind agent-browser session selection in the Provider and relay

The Panerelay agent-browser Provider recognizes only the exact reserved v1 session pattern. It selects the named live browser registration instead of the user's default, and includes the decoded target ID in the additive relay-session creation request. Ordinary user session names remain unchanged.

The relay stores an optional `initialTargetId` on the participant. Before accepting a hinted participant, it refreshes the Extension's authorized target inventory and rejects the session if the exact target is absent. Initial `Target.getTargets` output and initial `Target.targetCreated` publication are ordered per participant with that target first. The target is rechecked immediately before initial publication to close the allocation/discovery race.

agent-browser 0.33.0 therefore assigns that first target `t1` using its unchanged upstream logic. The relay continues exposing the participant's other authorized initial targets and controlled lineage after the first item, so cross-tab workflows are not removed. Filtering the participant to only one page was rejected because it would silently change existing all-tabs semantics. Merely putting the UUID in the prompt without Provider binding was rejected because `--session` isolates agent-browser state but does not select a page by itself.

### Use Browser Use's exact target API without changing daemon ownership

Browser Use guidance supplies the target UUID directly to the existing `switch_tab(targetId)` helper and keeps `BU_NAME=panerelay` plus the current persistent gateway behavior. `switch_tab` already sends unchanged target activation and flattened attach requests through the participant; the relay's existing exposure checks reject a target that is absent from that lane's inventory.

No target-specific `BU_NAME` is introduced. Although a unique daemon name could emulate per-conversation sessions, Browser Harness intentionally daemonizes each name, Panerelay cannot reliably observe provider-conversation completion, and abandoned conversations would accumulate detached daemons. If the existing shared lane is pinned to a different browser/generation or predates the target's exposure, the exact selection fails and the Skill reports that bounded limitation rather than restarting the daemon or falling back to Direct mode.

### Give Playwright a target-scoped explicit attach URL

The Playwright environment module gains a target-scoped gateway URL whose base64url token contains only the opaque browser and target UUIDs. The gateway resolves the named current browser registration, requests a bootstrap ticket with `initialTargetId`, and labels the actor with the same derived session name. The token is a loopback locator, not a bearer credential; the returned ticket and WebSocket credentials retain their current short-lived boundaries.

The Agent uses the same derived value with Playwright CLI's `-s=<session>`, attaches to the target-scoped URL, runs `tab-list`, and selects index `0`. The relay's per-participant initial ordering makes index `0` the exact target without changing Playwright. If the target check fails during `/json/version` participant allocation, the gateway returns a bounded unavailable response and invalidates the participant before Playwright can publish another page as index `0`.

Matching URL/title after `tab-list` was rejected because it is ambiguous. Using Playwright `run-code` plus private or raw-CDP page inspection was rejected as an upstream-semantic workaround. Modifying or patching Playwright to expose a target ID was rejected by the external-dependency boundary.

### Keep target hints fail-closed and non-authorizing

Additive `initialTargetId` fields on relay-session and CDP-bootstrap requests are accepted only from authenticated local Provider/gateway paths and only after a browser registration is selected. They never seed Extension authorization or participant exposure. The target must already be present in the Extension-produced authorized inventory; absence returns the same bounded target-unavailable class whether the tab is closed, unauthorized, stale, or belongs elsewhere.

Hint validation performs no debugger attachment or mutation. Normal participant allocation and lease visibility remain unchanged, and the first control-class command still owns the observed-to-controlled transition. Revocation removes the target through existing lifecycle handling; the hint cannot republish it.

### Preserve version-scoped evidence

Deterministic tests cover UUID validation, context rendering, reserved-session parsing, exact browser selection, target-ordering on both discovery forms, allocation/discovery races, stale and unauthorized failures, Browser Use helper guidance, target-scoped gateway parsing, and revocation. Retained probes then verify the unchanged pinned engines: agent-browser 0.33.0 receives `t1`, Browser Use 0.13.7/Browser Harness 0.1.8 switches by target ID on its shared lane, and Playwright CLI 0.1.17 receives index `0` in the named session.

Until each real probe passes, the new targeting row is `Automated` or `Forwarded` in its version-specific compatibility document rather than inheriting an existing `Verified` label.

## Risks / Trade-offs

- [ACP provider-native transcripts can retain opaque target hints] → Ship after/with v1 context normalization, document that ACP lacks a hidden system role, and rely on the fact that opaque IDs and locator URLs are not credentials or authority.
- [The Extension service worker restarts after context capture] → Treat the UUID as stale and fail without selecting a fallback tab; a new conversation receives a fresh hint.
- [Browser Use's persistent participant cannot see a newly opened independent tab] → Preserve RFC-0007's bounded inventory and report the exact target as unavailable rather than expanding it or spawning another daemon.
- [Upstream discovery order changes in a later engine] → Pin evidence to the tested versions and keep newer versions outside `Verified` until their target assignment is reprobed.
- [A user intentionally chooses the reserved agent-browser session pattern] → Treat the prefix as Panerelay-reserved, validate the complete UUID form, and return a clear target-hint error; all other names keep current behavior.
- [Target disappears between allocation and initial discovery] → Revalidate before publishing inventory and release the hinted participant on failure.

## Migration Plan

1. Land the ACP v1 context-envelope/history normalization and prompt-lifecycle fix first.
2. Add the lockstep protocol fields and validators, then Extension capture and Bridge context rendering.
3. Add relay target-hint allocation/ordering and agent-browser Provider binding behind the reserved v1 session format.
4. Add the target-scoped Playwright gateway route; keep all existing unscoped gateway URLs and ordinary session names backward compatible.
5. Update RFC-0002 and RFC-0007, the Skill, compatibility matrices, and retained probes before claiming release support.
6. Existing conversations and unscoped automation sessions continue unchanged. Rollback removes target guidance and target-scoped parsing; opaque IDs already stored in provider-native text remain inert and non-authorizing.
