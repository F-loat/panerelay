## Context

See `proposal.md` for the agent-browser 0.33.0 bootstrap behavior that motivates this change. RFC-0002 currently equates debugger attachment after a substantive read with control, while RFC-0003 exposes attached-target count as controlled-target count. The Extension also uses one `controlledTabs` map for debugger routing, badge count, tab actions, and favicon state.

`Network.enable` is a continuous subscription: deferring it until a later business command loses earlier request events. Conversely, method domains cannot safely establish read-only intent because `Runtime.evaluate`, DOM, CSS, Network, Storage, and other domains contain both read and mutation operations.

## Goals / Non-Goals

**Goals:**

- Preserve early page/runtime/network events requested by unmodified agent-browser 0.33.0.
- Keep passive observation out of the controlled count and favicon.
- Keep every debugger attachment visible and immediately revocable.
- Use one fail-closed classifier for Bridge state and Extension presentation.
- Prevent an active Agent session from automatically discovering tabs that the user opens independently after initialization.

**Non-Goals:**

- Prove that arbitrary JavaScript is side-effect free.
- Add command-intent metadata to agent-browser.
- Hide Chrome's debugger attachment or downgrade existing authorization checks.
- Change `Verified`, `Forwarded`, `Partial`, or `Unsupported` compatibility classifications except where new evidence specifically changes them.

## Decisions

### Track attachment and control independently

The Bridge retains `attachedTargets` as the debugger-routing truth and adds a monotonic `controlledTargets` subset. `observedTargetCount` is `attachedTargets - controlledTargets`; `controlledTargetCount` comes only from the subset. Detach removes a target from both sets.

The Extension mirrors this with an attachment map used for CDP routing and a controlled subset used for the action badge, controlled-tab list, and favicon. This keeps actual debugger ownership visible in the side-panel session summary while preserving the existing immediate lease release path.

Alternative: hide read-only attachments and keep one map. Rejected because Chrome is still debugger-attached and network observation remains active.

### Attach for passive setup instead of replaying it later

Only target discovery, virtual flattened sessions, foreground activation, and page-scoped auto-attach configuration remain virtual. `Page.enable`, `Runtime.enable`, and `Network.enable` attach and forward immediately as observation. This preserves events and removes the replay ordering/race introduced by deferring subscription commands.

Alternative: defer every enable command. Rejected because Network events are not recoverable after the fact.

### Use an explicit read-only method allowlist

The shared protocol exports a target-access classifier with `observe` and `control` results. The observation allowlist includes passive domain setup, concrete getters, screenshots, page snapshots, and PDF capture because they do not mutate browser or page state. Unknown methods, `Runtime.evaluate`, `Runtime.callFunctionOn`, navigation, input, setters, interception, emulation, tracing/profiling, and other ambiguous commands classify as control.

Target-management commands remain governed by their existing synthetic handlers. Creating or selecting a background target does not itself mark its document; target-scoped commands determine observation or control.

Alternative: reuse activity categories or classify entire CDP domains. Rejected because the activity classifier is informational and intentionally groups mixed read/write methods.

### Upgrade before forwarding a control-class command

After authorization and policy checks succeed, the Bridge adds the target to the controlled subset before forwarding the first control-class command. The Extension performs the same monotonic upgrade before command execution, updates its badge/status, and best-effort applies the favicon. A failed command remains evidence that active control was attempted through the still-attached debugger; the target stays controlled until detach.

### Deduplicate target metadata at the Extension boundary

The Extension serializes lifecycle publication per Chrome tab, compares the next target information to the last sent value, and suppresses unchanged `target.updated` messages. The first committed publication is `created`; later metadata is `changed`. Attachment-state changes still publish because they alter observable target metadata. Resolving the event type inside the serialized operation prevents concurrent `tabs.onCreated` and `tabs.onUpdated` handlers from both publishing `created`.

### Bound discovery expansion to controlled opener relationships

The Extension treats target exposure as lease-scoped state. The first target-list request seeds every currently eligible tab so agent-browser keeps its existing startup and tab-selection behavior. Later target-list requests return only that exposed inventory.

After the seed, a tab can enter the inventory through either:

- an Agent `Target.createTarget` request; or
- a Chrome-reported `tabs.Tab.openerTabId` or `webNavigation.onCreatedNavigationTarget` relationship whose source tab is already in the controlled subset.

An observed source does not qualify. A control-class command upgrades the source before Chrome executes it, so a popup caused by an Agent click or arbitrary script is eligible by the time Chrome reports the relationship. A user action inside an already controlled page is intentionally treated the same way; Chrome can attest the opener relationship but not which actor caused it.

Ordinary new tabs have no exposure reservation, so their create, update, activation, and removal events stay Extension-private. Filtering later list results as well as lifecycle events prevents reconnects or additional participants in the same lease from rediscovering them. Releasing the lease clears the exposure inventory.

Alternative: publish all eligible new tabs as observed. Rejected because unmodified agent-browser eagerly initializes every published target, attaching the debugger and growing observation state for unrelated browsing.

Alternative: require proof that the Agent, rather than the user, opened the related tab. Rejected because Chrome's trusted relationship events identify the source tab but not the initiating actor, and the product only requires controlled-lineage containment.

## Risks / Trade-offs

- **A high-level read implemented with `Runtime.evaluate` appears controlled** → Fail closed; a future agent-browser intent signal can safely narrow this without parsing JavaScript.
- **Initial observation attaches debugger to every target initialized by agent-browser** → Keep the initial inventory compatible, prevent unrelated later expansion, show the observed total explicitly, and keep one-click lease release.
- **A new side-panel participant joins a still-live lease from an unrelated tab** → It inherits the lease's bounded exposed inventory; a future participant-scoped root-target protocol can narrow or expand this explicitly without using focus as authorization.
- **A nominal getter has undocumented side effects** → Keep the allowlist narrow and add methods only with protocol documentation and regression evidence.
- **Bridge and Extension classifications drift** → Export the classifier from the shared protocol package and cover both state transitions and presentation with tests.

## Migration Plan

1. Add protocol classification and `observedTargetCount` with strict validation.
2. Replace the Bridge's deferred-enable prototype with independent attachment/control tracking.
3. Split Extension attachment routing from controlled presentation and deduplicate target updates.
4. Add a focused RFC that supersedes RFC-0002's attachment-as-control decision, link it from RFC-0002, update draft RFC-0003, and revise the agent-browser 0.33.0 compatibility matrix.
5. Verify that a new external tab is observed without badge/favicon changes, Network history is retained, and the first control-class command upgrades exactly once.
6. Bound later target discovery to Agent-created or controlled-opener tabs and serialize per-tab publication.
7. Roll back by restoring attachment-as-control counting and all-eligible lifecycle publication; no persisted state migration is required.
