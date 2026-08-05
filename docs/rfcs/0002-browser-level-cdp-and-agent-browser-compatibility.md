# RFC-0002: Browser-level CDP and agent-browser compatibility

- RFC: 0002
- Title: Browser-level CDP and agent-browser compatibility
- Status: Accepted
- Authors: F-loat
- Created: 2026-07-29
- Updated: 2026-08-05
- Amendments: `openspec/changes/archive/2026-08-04-add-conversation-target-hints`, `openspec/changes/shorten-conversation-target-session`

RFC-0004 supersedes this RFC's attachment-as-control and control-visibility semantics. Target discovery and flattened sessions remain virtual, while passive observation may now attach without entering the controlled count or changing the favicon.

## Summary

Panerelay will expose a browser-level Chrome DevTools Protocol endpoint to agent-browser while continuing to attach Chrome's debugger only to authorized tabs. The Bridge synthesizes browser target discovery and lifecycle, maps opaque CDP target and session identifiers, forwards page-scoped commands through the Extension, and virtualizes foreground activation so Agent tab selection does not steal the user's visible Chrome focus.

The minimum supported and initial version-specific verified baseline is agent-browser 0.33.0. Newer versions satisfy the version floor but require their own evidence before inheriting `Verified` classifications. Panerelay targets broad support for normal browser automation without claiming that an Extension connection is equivalent to a Chrome process launched and owned by agent-browser.

## Motivation

RFC-0001 proved that unmodified agent-browser commands can operate one existing authorized tab through a direct-page Provider. Direct-page mode cannot represent multiple tabs, popup discovery, target switching, or flattened child sessions. It also makes agent-browser intentionally skip its browser-level Target workflow.

Panerelay needs browser-level semantics to cover agent-browser's normal tab model while preserving the user's daily browser, explicit Chrome permissions, visible debugger state, and immediate revocation.

## Goals

1. Return a normal browser-level CDP endpoint from the Panerelay Provider.
2. Support target discovery, background create, attach, logical activate, close, and lifecycle events.
3. Support stable agent-browser tab IDs and labels without exposing Chrome tab IDs.
4. Route flattened iframe and worker sessions through the owning authorized tab.
5. Keep debugger attachment lazy so merely listing daily-browser tabs does not attach every tab.
6. Pin and publish an evidence-based agent-browser compatibility matrix.
7. Fail unsupported browser ownership and containment features explicitly.

## Non-goals

1. Make the user's daily Chrome process behave like a disposable browser launched by agent-browser.
2. Close Chrome through `Browser.close`.
3. Create truly isolated Chrome browser contexts or incognito profiles.
4. Apply process startup flags, proxies, extensions, profiles, or executables after Chrome started.
5. Claim operating-system network containment from Extension permissions.
6. Permit overlapping target-scoped mutation without deterministic serialization.

## Target model

The Extension owns a session-local map between Chrome tab IDs and random opaque Panerelay target IDs. Raw Chrome tab IDs remain Extension-private.

- Single-tab authorization exposes only the selected tab and exact authorized origin.
- All-tabs authorization seeds the discovery lease with supported tabs covered by Chrome's granted HTTP and HTTPS origin permissions.
- After the initial seed, the exposed inventory expands only for Agent-created tabs or tabs Chrome reports as opened from a currently controlled tab. Independently opened tabs remain private to Chrome for the rest of that lease.
- `chrome://`, `chrome-extension://`, DevTools, and other browser-internal pages are not exposed.
- An all-tabs session may create `about:blank` tabs and navigate them to granted web origins.
- A single-tab session cannot create additional tabs.
- Agent-created tabs open with `active: false`. Agent target selection is participant-local and does not change Chrome's user-visible active tab or focused window.

The active eligible tab is returned first for an ordinary participant. A conversation-targeted participant returns its exact hinted authorized target first instead. agent-browser attaches a flattened CDP session to every reported page during initialization, but Panerelay treats those as virtual Bridge sessions. Page-scoped `Target.setAutoAttach` is also virtual bootstrap. RFC-0004 governs later debugger attachment and the observation/control distinction.

## Conversation target orientation

The Extension may include the current browser's opaque registration UUID and the existing opaque Panerelay target UUID in a new Side Panel conversation. These values are locating data only: they do not encode a Chrome tab ID, grant site permission or tab authorization, acquire control, attach the debugger, or expand a participant's exposed inventory.

For agent-browser, Panerelay decodes each canonical UUID into 16 bytes and derives the 56-character reserved session value `panerelay-v2-<base64url(browser-bytes || target-bytes)>`. Its unpadded 43-character payload is reversible and canonical, while the complete value stays within agent-browser 0.33.0's 64-character session-name limit and portable character set. The Provider plugin recognizes only this exact current form, selects the named live browser registration instead of the saved default, and forwards the target UUID as the participant's optional initial target. Malformed current values and the unusable overlong `panerelay-tab-v1-...` prefix fail before default-browser selection; unrelated names such as `panerelay-task` retain the ordinary Provider path.

Before allocating a targeted participant and again before initial discovery, the Bridge refreshes the selected browser's authorized inventory. It orders the exact target first in both `Target.getTargets` and initial `Target.targetCreated` publication, which makes it agent-browser's session-local `t1`. If the target is missing, stale, revoked, from another browser, or disappears during allocation, the Bridge returns one bounded target-unavailable failure and invalidates the participant rather than assigning `t1` to another page. Later tab creation, logical selection, close, controlled-lineage discovery, and participant cleanup keep their existing semantics.

## Browser-level CDP surface

The Bridge synthesizes:

- `Browser.getVersion`;
- `Target.setDiscoverTargets`;
- `Target.getTargets`;
- `Target.getTargetInfo`;
- `Target.attachToTarget` with `flatten: true`;
- `Target.detachFromTarget`;
- `Target.createTarget`;
- `Target.activateTarget`;
- `Target.closeTarget`;
- `Target.getBrowserContexts`.

The Extension reports creation, metadata changes, and removal only for targets in the lease's exposed inventory. The Bridge translates them to `Target.targetCreated`, `Target.targetInfoChanged`, and `Target.targetDestroyed`. Chrome `tabs.onCreated` and `webNavigation.onCreatedNavigationTarget` relationships expand that inventory only when the source is already controlled. Publication is serialized per Chrome tab so creation and loading updates cannot emit duplicate `targetCreated` events.

`Target.activateTarget` acknowledges agent-browser's logical selection without calling `chrome.tabs.update` or `chrome.windows.update`. Page-scoped `Page.bringToFront` similarly returns success without foregrounding Chrome or attaching the target solely for activation. Page reads, navigation, DOM focus, keyboard, mouse, and other explicitly requested automation continue to execute against the participant's selected authorized target in the background.

`Target.createBrowserContext`, non-flattened sessions, and unsupported Target operations return explicit CDP errors.

## Session routing

A browser connection can contain three identifier layers:

1. an opaque Panerelay target ID for an eligible Chrome tab;
2. a Bridge-generated flattened page session ID returned by `Target.attachToTarget`;
3. a Chrome debugger child-session ID for an auto-attached iframe, worker, or related target.

The Bridge maps page sessions to targets. The Extension forwards the `sessionId` supplied by `chrome.debugger` events for child targets, and accepts it on later commands. Main-frame events are copied to each Bridge page session for their owning target.

agent-browser normally requests page-scoped auto-attach with `waitForDebuggerOnStart: true`. While the owning target remains virtual, Panerelay defers that setup. On first substantive page use it keeps flattened child discovery enabled but replays the request with waiting disabled before the triggering command. This prevents a newly opened or discovered tab from becoming controlled solely because of protocol initialization, and prevents a newly navigated renderer from remaining paused when the Extension cannot establish the same browser-process-wide interception guarantees. Panerelay still rejects the equivalent top-level request instead of claiming `--allowed-domains` containment.

Virtual page and child-session identifiers are participant-local and discarded when their target, transport, participant, lease, Extension, or Bridge disconnects.

## Ownership and visibility

One exclusive Panerelay automation lease may contain bounded, independently authenticated relay participants. Participants reuse the lease-wide target inventory and Chrome debugger attachment, but receive distinct flattened page sessions, pending-command correlation, logical target selection, heartbeat, and cleanup. Complete target-scoped command lifecycles are processed FIFO per target, so two participants never forward overlapping commands to the same target. Releasing one participant preserves a target attachment while another participant still references it; releasing authorization detaches every controlled target and invalidates every participant credential.

The Extension action badge reports the number of substantively controlled tabs, not virtual target or page-session bootstrap. Each attached page temporarily uses the agent-browser favicon with a green control-status dot after an Agent command touches its current document. Target-domain setup and child-session wake-up do not mark the top-level document. Navigation or refresh restores the new document's page-owned favicon; the next document-touching Agent command reapplies the indicator. Normal target detach and lease release restore the page-owned favicon when the marked document survives. This favicon is a document-local activity cue, not the authoritative lease state. The side panel reports participant and controlled-tab counts and keeps immediate release available through browser authorization.

A debugger displacement or target-specific authorization failure clears the affected debugger attachment without invalidating unrelated targets. A normal agent-requested target close removes only that target. Releasing browser authorization revokes the complete lease and every participant.

## Compatibility policy

Panerelay classifies agent-browser commands into three levels:

- **Verified**: covered by contract tests and a real daily-Chrome run against the pinned version.
- **Forwarded**: built from page-scoped CDP methods supported by `chrome.debugger`, with package tests but without a dedicated real-browser scenario yet.
- **Unsupported**: requires browser process ownership, isolated contexts, or security guarantees the Extension cannot provide.

The checked-in compatibility matrix is version-specific. A new agent-browser version is not marked supported until its handshake and representative command groups pass.

### Network containment

Panerelay does not support agent-browser's `--allowed-domains` mode in this release. Although flattened iframe and worker sessions are forwarded, a Chrome Extension cannot guarantee that a newly opened top-level tab is paused before its first request. Panerelay therefore rejects top-level `Target.setAutoAttach` with `waitForDebuggerOnStart: true` instead of implying complete containment.

Page-scoped request observation, HAR capture, request routing, headers, and credentials can be supported independently when their CDP commands work through an attached authorized target.

## Alternatives considered

### Keep direct-page mode and add custom tab actions

agent-browser deliberately skips browser-level Target behavior for direct-page Providers. Custom Panerelay tab commands would split automation semantics between projects and would not support normal agent-browser CLI or MCP tab workflows.

### Attach every eligible tab during discovery

agent-browser creates logical sessions for all discovered page targets. Mirroring that directly with `chrome.debugger.attach` would display debugger state and create conflicts on every authorized daily-browser tab even if the Agent never touches them. Lazy debugger attachment preserves normal browser-level semantics without that side effect.

### Report every later eligible tab

Unmodified agent-browser initializes every reported target. Reporting tabs the user opens independently would therefore attach observation and grow Agent-visible state unrelated to the task. Panerelay keeps the initial inventory compatible, then reports only Agent-created targets and Chrome-reported descendants of controlled tabs.

### Pretend that Chrome windows are isolated browser contexts

A normal Chrome window is not an isolated CDP browser context. Returning a synthetic context ID would misrepresent cookie, storage, cache, and network isolation. `window new` remains unsupported until Panerelay can provide honest semantics.

### Activate a tab temporarily and restore the user's prior tab

Temporary foreground activation still flickers, interrupts typing, races with human tab changes, and may restore the wrong tab. Panerelay instead acknowledges Agent activation logically and routes later page commands through the participant's virtual target session.

## Delivery

1. Add target and child-session fields to the versioned Native Messaging protocol.
2. Replace the direct-page relay with browser-level target synthesis and lazy debugger attachment.
3. Return `directPage: false` from the agent-browser Provider.
4. Cover target handshake, lifecycle, child sessions, participant credentials, target serialization, independent cleanup, and revocation in Bridge tests.
5. Add real-browser fixtures for tab, popup, page action, network, storage, and diagnostic groups.
6. Publish the agent-browser 0.33.0 compatibility matrix.

## Acceptance criteria

RFC-0002 is implemented when:

1. agent-browser 0.33.0 completes its browser-level connection handshake;
2. existing authorized tabs appear with stable agent-browser tab IDs;
3. tab create, switch, list, and close pass in a daily Chrome profile without Agent selection, foreground requests, or background creation changing the user's visible active tab or focused window;
4. a popup is discovered and becomes controllable;
5. existing single-tab actions remain passing;
6. flattened child-session commands and events pass contract tests;
7. unsupported context and containment operations return explicit errors;
8. debugger attachment remains lazy and all attachments clear on release.
9. independently opened tabs after initialization remain absent from target events and later target lists;
10. Agent-created tabs and tabs opened from controlled sources are discovered exactly once.
11. a generated conversation-target session satisfies agent-browser 0.33.0's session-name constraints, binds its exact authorized target to `t1`, and rejects malformed or legacy target prefixes without browser fallback.

All acceptance criteria pass in the development build against agent-browser 0.33.0. The RFC remains `Accepted` until this implementation is released.
