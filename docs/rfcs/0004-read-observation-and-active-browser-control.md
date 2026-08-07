# RFC-0004: Read observation and active browser control

- RFC: 0004
- Title: Read observation and active browser control
- Status: Accepted
- Authors: F-loat
- Created: 2026-07-30
- Updated: 2026-08-06
- OpenSpec amendment: `openspec/changes/track-participant-control-claims`
- Supersedes: RFC-0001 and RFC-0002 attachment-as-control and control-visibility semantics
- Related: RFC-0009 browser fetch does not attach, observe, or control a tab.

## Summary

Panerelay separates an authorized target's debugger attachment from active browser control. Passive agent-browser setup and explicitly allowlisted read-only CDP commands may attach a target as observed so events are available from the time the Agent requests them. Observation does not increase the controlled-target badge or replace the page favicon. Navigation, interaction, mutation, emulation, arbitrary JavaScript, and unknown target-scoped commands acquire or refresh the sending participant's target-control claim before they are forwarded.

Observed attachments remain visible in the side panel and share the same immediate lease-revocation path as controlled targets. The initial eligible inventory remains compatible with agent-browser, but later target discovery expands only for Agent-created tabs or Chrome-reported descendants of controlled tabs. The distinction changes presentation, not Chrome permission, target authorization, command routing, or the user's ability to release the Agent.

## Motivation

agent-browser 0.33.0 initializes each discovered page session with `Page.enable`, `Runtime.enable`, and `Network.enable`. Treating those commands as active control marks newly opened or unrelated eligible tabs before the Agent performs a requested action. Deferring every enable command avoids the marker but loses Network events that occur before the first later page command; those events cannot be reconstructed.

Debugger attachment is therefore necessary for complete requested observation, but it is not sufficient evidence that the Agent navigated, interacted with, or modified the page. Panerelay needs separate states without concealing the debugger connection.

## Goals and non-goals

### Goals

1. Preserve early page, runtime, and network events requested by unmodified agent-browser 0.33.0.
2. Keep passive observation out of the controlled count and page favicon.
3. Upgrade target state before forwarding commands that can control or mutate the browser.
4. Keep every debugger attachment visible, bounded by authorization, and immediately revocable.
5. Classify read-only access fail-closed through one shared policy.
6. Prevent ordinary tabs opened independently during an active lease from entering Agent observation.

### Non-goals

1. Prove arbitrary JavaScript expressions are side-effect free.
2. Modify agent-browser's CLI, daemon, or CDP command semantics.
3. Hide Chrome's debugger indicator or describe an attached target as unattached.
4. Record page content, command parameters, results, request bodies, or raw Chrome identifiers.
5. Guarantee events for a CDP domain before agent-browser enables that domain.

## Terminology

- **Virtual target**: an authorized target known to the Bridge without a Chrome debugger attachment.
- **Observed target**: a debugger-attached target that has received only passive setup or explicitly allowlisted read-only commands.
- **Target-control claim**: one participant's live control state for an attached target, carrying its validated engine and latest control sequence.
- **Controlled target**: an attached target with at least one live participant target-control claim.
- **Exposed target**: a target in the active lease's bounded inventory and therefore visible to agent-browser.
- **Control-class command**: a target-scoped command not present in the explicit observation allowlist.

A participant's claim is monotonic while that participant retains a target reference. The aggregate target may downgrade to observed without detach after its final live claim ends.

## Proposed design

### Independent attachment and control state

The Bridge keeps the debugger-attachment set used for routing and participant-scoped control claims used for product control state. The controlled set is the targets with one or more live claims, and the observed count is the set difference; a target appears in exactly one of the observed and controlled counts.

The Extension mirrors this separation. Its attachment map routes CDP commands and events and drives cleanup. Its controlled subset drives the action badge, controlled-tab action list, and document-local favicon. Participant cleanup may update or clear the controlled subset without detaching the target. The side panel displays observed and controlled totals separately and retains the existing whole-lease release action.

### Passive setup attaches immediately

Target discovery, flattened page-session creation, `Target.activateTarget`, `Page.bringToFront`, and page-scoped auto-attach configuration remain virtual. `Page.enable`, `Runtime.enable`, and `Network.enable` attach and forward immediately. Deferred page-scoped auto-attach is replayed with `waitForDebuggerOnStart: false` before the first forwarded page command, preserving RFC-0002's child-target safety boundary.

This ordering allows `Network.requestWillBeSent` and related events to be collected before a later request-list or HAR command reads agent-browser's cache.

### Controlled-lineage target discovery

The first Extension target-list request seeds the active lease with every currently eligible target. Later list requests return only that exposed inventory. The inventory expands for:

- a successful Agent `Target.createTarget` request; or
- a new tab whose `tabs.Tab.openerTabId` or `webNavigation.onCreatedNavigationTarget.sourceTabId` identifies a source already in the controlled subset.

An observed source does not qualify. Control-class commands upgrade their source before forwarding, so a popup caused by an Agent click or arbitrary script is eligible when Chrome reports it. Chrome does not identify whether the Agent or user caused an action inside a controlled page; both are intentionally accepted as controlled lineage.

Independently opened tabs remain absent from lifecycle events and later target lists for the rest of the lease. Release clears the inventory so a future lease can seed current browser state again.

### Explicit observation allowlist

The shared protocol package owns a method-level classifier returning `observe` or `control`. Observation includes passive enable/disable commands; concrete getters in Accessibility, CSS, DOM, DOMSnapshot, Fetch, IO, Log, Network, Page, Performance, Runtime, Security, and Storage; screenshots, page snapshots, PDF capture; and page-scoped auto-attach.

The allowlist does not classify a whole CDP domain. `Runtime.evaluate`, `Runtime.callFunctionOn`, setters, navigation, Input, interception, emulation, tracing, profiling, and unknown methods are control-class commands. This access classifier is separate from RFC-0003's provider-neutral activity categories, which are informational and can group read and write methods together.

### Participant-monotonic claims and aggregate downgrade

After target authorization and command policy checks pass, the Bridge acquires or refreshes the sending participant's claim before forwarding a control-class command. The Extension applies the same aggregate upgrade before calling `chrome.debugger.sendCommand`, updates the badge and side-panel tab list, and best-effort applies the controlled favicon. One latest claim is retained per participant, and its sequence is refreshed by each later control-class command.

A failed forwarded command leaves that participant's claim live: arbitrary control was attempted through a live debugger attachment, and the user-visible state must not disappear merely because Chrome returned an error. When a participant's final target reference or participant lifetime ends, the Bridge removes its claim. A remaining newest claim supplies fallback engine attribution; no remaining claim downgrades a still-referenced attachment to observed.

Favicon fallback is current-document-local. A claim transition replaces an existing Panerelay marker but never creates one after navigation removed it. The next control-class command may mark the new current document. A transition to no claims restores the captured current-document favicon without forcing debugger detach.

### Serialized target metadata publication

The Extension serializes lifecycle publication per Chrome tab and remembers the last target metadata delivered through list, create, or lifecycle publication. The first committed lifecycle publication is `targetCreated`; later URL, title, attachment, or active-state changes are `targetInfoChanged`; unchanged updates are suppressed. This prevents concurrent `tabs.onCreated`, `tabs.onUpdated`, and activation handlers from emitting duplicate creation events.

## Protocol and data model

`ControlSessionSummary` includes `observedTargetCount`; `controlledTargetCount` reports targets with at least one live claim. Both are non-negative integers validated with the existing strict envelope rules. The strict `cdp.control.updated` presentation message carries only an opaque target ID and a closed engine identifier or `null`, allowing participant-local fallback or restoration independently from physical detach.

No raw Chrome tab ID, debugger session ID, command parameter, result, or page value is added. Observation and control continue to use the existing lease, participant credentials, CDP transport, activity stream, and release messages.

## Security and privacy

1. Observation never widens site permission or tab authorization.
2. The side panel exposes observed attachments even when the controlled count is zero.
3. Unknown or ambiguous methods fail closed into control state.
4. Arbitrary JavaScript is never inferred to be read-only from its text.
5. User release detaches observed and controlled targets alike.
6. Activity records remain sanitized and bounded independently of access classification.
7. The favicon remains a document-local control cue, not the authoritative debugger-attachment signal.
8. Target exposure remains narrower than site permission: an independently opened tab can be authorized for Chrome access without becoming visible to the active Agent lease.

## Compatibility and migration

The initial compatibility target remains agent-browser 0.33.0. The change is transparent to agent-browser because it uses the same CDP endpoint and response shapes. Panerelay's Extension, Bridge, and protocol packages remain a lockstep release unit because the control-session summary gains a required field.

There is no persisted target-state migration. Restarting the Extension or Bridge ends the lease and clears attachments and claims. Newer automation-engine versions require version-specific evidence before inheriting a verified result.

## Alternatives considered

### Defer every enable command

Rejected because continuous Network events emitted before `Network.enable` cannot be recovered by a later read.

### Count every debugger attachment as control

Rejected because unmodified agent-browser attaches for passive initialization of every discovered eligible target, causing misleading counts and favicons.

### Hide read-only attachments

Rejected because Chrome remains debugger-attached and the user must be able to see and revoke observation.

### Classify whole CDP domains

Rejected because common domains mix getters, mutations, interception, and arbitrary script execution.

### Parse JavaScript to infer side effects

Rejected because practical static analysis cannot safely prove arbitrary `Runtime.evaluate` or `Runtime.callFunctionOn` input is side-effect free.

### Report every eligible tab opened during the lease

Rejected because agent-browser eagerly initializes every reported target. This would attach observation to unrelated user browsing and make the Agent-visible inventory grow without a controlled relationship.

### Require proof that the Agent opened a related tab

Rejected because Chrome reports the source relationship but not the initiating actor. Controlled-lineage containment is sufficient for this release.

## Delivery plan

1. Add the shared classifier and observed-target summary field.
2. Track attached and controlled target sets independently in the Bridge.
3. Split attached and controlled tab state in the Extension.
4. Restrict badge and favicon changes to control-class commands.
5. Deduplicate unchanged target metadata.
6. Update the side panel, RFC-0003, compatibility evidence, and automated tests.
7. Run a daily-Chrome agent-browser 0.33.0 scenario for new-tab initialization, Network history, control upgrade, and cleanup.
8. Bound later discovery to Agent-created targets and controlled opener relationships, and serialize each tab's lifecycle publication.

## Acceptance criteria

1. Target listing and virtual page-session creation do not attach a debugger.
2. Page/runtime/network setup may attach one target and reports it as observed with zero controlled targets.
3. An early Network event is available before any control-class command.
4. Passive setup and allowlisted reads do not change the action badge or page favicon.
5. The first control-class command moves the target from observed to controlled exactly once and marks the current document.
6. `Runtime.evaluate` and unknown methods are control-class commands.
7. Unchanged Chrome tab updates do not produce repeated target metadata events.
8. Detach and whole-lease release clear both states and restore a surviving controlled document's favicon.
9. Protocol, Bridge, Extension, full-repository, strict OpenSpec, and daily-Chrome checks pass.
10. An independently opened eligible tab after initialization stays absent from target lists and counts.
11. An Agent-created target and a tab opened from a controlled source are each discovered exactly once.
12. Removing the newest participant claim falls back to the newest remaining engine, while removing the last claim restores observed state without detaching a target still referenced by another participant.

## Implementation evidence

The 2026-07-30 development build passed protocol, Bridge, Extension, side-panel component, typecheck, formatting, lint, build, strict OpenSpec, and full-repository checks.

A daily-Chrome agent-browser 0.33.0 run created an inactive loopback fixture tab with repeated delayed requests. Before any control-class command, allowlisted DOM reads found no Panerelay favicon marker and the Agent's Network cache contained successful delayed requests. The first `Runtime.evaluate` observed the controlled marker during command execution, and a repeated evaluation still found exactly one marker. The exact test tab, Agent participants, and temporary server were removed after verification. Count separation and cleanup paths are also covered by deterministic Bridge and Extension tests.

A 2026-07-31 daily-Chrome run verified bounded target expansion. An independently opened loopback tab stayed absent from an existing Agent participant and from a newly initialized participant. An Agent-created parent and a Chrome-reported child of that controlled parent each appeared exactly once. A child whose opener was an observation-only Agent-created source stayed absent from both participants. The two Agent participants, all fixture tabs, and the temporary server were removed after the run.

The 2026-08-06 deterministic coexistence suite keeps an agent-browser observer attached while Browser Use and Playwright issue control-class commands on the same target. It verifies participant-local recency refresh, failed-command retention, engine fallback, last-claim downgrade, no unrelated detach, strict transition validation, current-document replace-only behavior, and full lease cleanup.

An updated lockstep daily-Chrome run on the same date exercised the visible transition with all three engines. Playwright temporarily became the newest claimant across the authorized inventory; detaching it restored agent-browser on Google, Browser Use on Bing, and the original favicon on Playwright-only DuckDuckGo without detaching the remaining participants. Releasing the exact agent-browser session then restored Google's original favicon while Browser Use stayed operational.

Two business pages already carried a cached Playwright favicon from the pre-update Extension background. Reloading the unpacked Extension necessarily discarded that background's isolated-world capture of their original favicon, so their cached visual could not be reconstructed without navigating or reloading the user pages. They had no live claim after the updated run. Acceptance deliberately left those pages untouched; this development-reload limitation does not affect documents first marked and released by the updated background.
