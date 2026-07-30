# RFC-0002: Browser-level CDP and agent-browser compatibility

- RFC: 0002
- Title: Browser-level CDP and agent-browser compatibility
- Status: Accepted
- Authors: F-loat
- Created: 2026-07-29
- Updated: 2026-07-30

## Summary

Panerelay will expose a browser-level Chrome DevTools Protocol endpoint to agent-browser while
continuing to attach Chrome's debugger only to authorized tabs. The Bridge synthesizes browser
target discovery and lifecycle, maps opaque CDP target and session identifiers, and forwards
page-scoped commands through the Extension.

The minimum supported and initial version-specific verified baseline is agent-browser 0.33.0.
Newer versions satisfy the version floor but require their own evidence before inheriting
`Verified` classifications. Panerelay targets broad support for normal browser automation without
claiming that an Extension connection is equivalent to a Chrome process launched and owned by
agent-browser.

## Motivation

RFC-0001 proved that unmodified agent-browser commands can operate one existing authorized tab
through a direct-page Provider. Direct-page mode cannot represent multiple tabs, popup discovery,
target switching, or flattened child sessions. It also makes agent-browser intentionally skip its
browser-level Target workflow.

Panerelay needs browser-level semantics to cover agent-browser's normal tab model while preserving
the user's daily browser, explicit Chrome permissions, visible debugger state, and immediate
revocation.

## Goals

1. Return a normal browser-level CDP endpoint from the Panerelay Provider.
2. Support target discovery, create, attach, activate, close, and lifecycle events.
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
6. Permit concurrent mutation by multiple relay sessions.

## Target model

The Extension owns a session-local map between Chrome tab IDs and random opaque Panerelay target
IDs. Raw Chrome tab IDs remain Extension-private.

- Single-tab authorization exposes only the selected tab and exact authorized origin.
- All-tabs authorization exposes supported tabs covered by Chrome's granted HTTP and HTTPS origin
  permissions.
- `chrome://`, `chrome-extension://`, DevTools, and other browser-internal pages are not exposed.
- An all-tabs session may create `about:blank` tabs and navigate them to granted web origins.
- A single-tab session cannot create additional tabs.

The active eligible tab is returned first. agent-browser attaches a flattened CDP session to every
reported page during initialization, but Panerelay treats those as virtual Bridge sessions.
`chrome.debugger.attach` occurs only when the first target-scoped command reaches a tab.

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

The Extension reports tab creation, metadata changes, and removal. The Bridge translates them to
`Target.targetCreated`, `Target.targetInfoChanged`, and `Target.targetDestroyed`.

`Target.createBrowserContext`, non-flattened sessions, and unsupported Target operations return
explicit CDP errors.

## Session routing

A browser connection can contain three identifier layers:

1. an opaque Panerelay target ID for an eligible Chrome tab;
2. a Bridge-generated flattened page session ID returned by `Target.attachToTarget`;
3. a Chrome debugger child-session ID for an auto-attached iframe, worker, or related target.

The Bridge maps page sessions to targets. The Extension forwards the `sessionId` supplied by
`chrome.debugger` events for child targets, and accepts it on later commands. Main-frame events are
copied to each Bridge page session for their owning target.

agent-browser normally requests page-scoped auto-attach with `waitForDebuggerOnStart: true`.
Panerelay keeps flattened child discovery enabled but forwards that request with waiting disabled.
This prevents a newly navigated renderer from remaining paused when the Extension cannot establish
the same browser-process-wide interception guarantees. Panerelay still rejects the equivalent
top-level request instead of claiming `--allowed-domains` containment.

Identifiers are discarded when the target, transport, lease, Extension, or Bridge disconnects.

## Ownership and visibility

One relay session retains the exclusive automation lease. It may lazily attach multiple authorized
targets under that lease. The Extension action badge reports the number of controlled tabs. Each
attached page temporarily uses the agent-browser favicon with a green control-status dot; normal
target detach and lease release restore the page-owned favicon. The side panel reports the same
controlled-tab count and keeps immediate release available. Releasing authorization detaches all
controlled targets and invalidates every connection credential.

A debugger displacement or target-specific authorization failure clears the affected debugger
attachment without invalidating unrelated targets. A normal agent-requested target close removes
only that target. Releasing browser authorization revokes the complete relay session.

## Compatibility policy

Panerelay classifies agent-browser commands into three levels:

- **Verified**: covered by contract tests and a real daily-Chrome run against the pinned version.
- **Forwarded**: built from page-scoped CDP methods supported by `chrome.debugger`, with package
  tests but without a dedicated real-browser scenario yet.
- **Unsupported**: requires browser process ownership, isolated contexts, or security guarantees
  the Extension cannot provide.

The checked-in compatibility matrix is version-specific. A new agent-browser version is not marked
supported until its handshake and representative command groups pass.

### Network containment

Panerelay does not support agent-browser's `--allowed-domains` mode in this release. Although
flattened iframe and worker sessions are forwarded, a Chrome Extension cannot guarantee that a
newly opened top-level tab is paused before its first request. Panerelay therefore rejects
top-level `Target.setAutoAttach` with `waitForDebuggerOnStart: true` instead of implying complete
containment.

Page-scoped request observation, HAR capture, request routing, headers, and credentials can be
supported independently when their CDP commands work through an attached authorized target.

## Alternatives considered

### Keep direct-page mode and add custom tab actions

agent-browser deliberately skips browser-level Target behavior for direct-page Providers. Custom
Panerelay tab commands would split automation semantics between projects and would not support
normal agent-browser CLI or MCP tab workflows.

### Attach every eligible tab during discovery

agent-browser creates logical sessions for all discovered page targets. Mirroring that directly
with `chrome.debugger.attach` would display debugger state and create conflicts on every authorized
daily-browser tab even if the Agent never touches them. Lazy debugger attachment preserves normal
browser-level semantics without that side effect.

### Pretend that Chrome windows are isolated browser contexts

A normal Chrome window is not an isolated CDP browser context. Returning a synthetic context ID
would misrepresent cookie, storage, cache, and network isolation. `window new` remains unsupported
until Panerelay can provide honest semantics.

## Delivery

1. Add target and child-session fields to the versioned Native Messaging protocol.
2. Replace the direct-page relay with browser-level target synthesis and lazy debugger attachment.
3. Return `directPage: false` from the agent-browser Provider.
4. Cover target handshake, lifecycle, child sessions, credentials, exclusivity, and revocation in
   Bridge tests.
5. Add real-browser fixtures for tab, popup, page action, network, storage, and diagnostic groups.
6. Publish the agent-browser 0.33.0 compatibility matrix.

## Acceptance criteria

RFC-0002 is implemented when:

1. agent-browser 0.33.0 completes its browser-level connection handshake;
2. existing authorized tabs appear with stable agent-browser tab IDs;
3. tab create, switch, list, and close pass in a daily Chrome profile;
4. a popup is discovered and becomes controllable;
5. existing single-tab actions remain passing;
6. flattened child-session commands and events pass contract tests;
7. unsupported context and containment operations return explicit errors;
8. debugger attachment remains lazy and all attachments clear on release.

All acceptance criteria pass in the development build against agent-browser 0.33.0. The RFC
remains `Accepted` until this implementation is released.
