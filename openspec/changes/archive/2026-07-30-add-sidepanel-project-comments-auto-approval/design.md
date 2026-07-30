## Context

See [proposal.md](./proposal.md) for motivation and the two delta specs for observable behavior. The existing draft-first flow creates a provider conversation inside `ConversationWorkspaceService.send`, while tab workspace identity and optimistic revisions stay Extension-private. `conversation.start` currently carries only a provider ID, Codex and Qoder default to the home directory, and the Side Panel already renders normalized provider approval events.

RFC-0001 already assigns explicit page-context sharing, user comments, and approval responses to the Extension/Side Panel and makes the Bridge the local policy boundary. This change implements those responsibilities without changing RFC-0001's opaque-target, site-authorization, or control-lease decisions, so it updates RFC-0001 rather than introducing a superseding RFC. The agent-browser baseline remains `0.33.0`; only the compatibility document's Side-panel provider sessions group changes.

## Goals / Non-Goals

**Goals:**

- Keep project selection and comment state aligned with the existing Extension-private tab workspace and revision model.
- Validate local paths and redact initial page metadata before provider use.
- Give both Codex and Qoder equivalent observable initial context even though their native session-start APIs differ.
- Keep automatic approval a visible Side Panel preference and preserve provider-native decision constraints.
- Make comment injection bounded, reversible, and dependent on current Chrome site authorization.

**Non-Goals:**

- Add raw Chrome tab IDs to the Agent protocol or teach agent-browser a Panerelay-specific tab selector.
- Turn the selected working directory into a sandbox root or an implicit command/file approval.
- Persist page comments across navigation, tab changes, Extension reload, or Chrome restart.
- Auto-approve Chrome permission prompts, browser authorization, control acquisition, or handoff.
- Claim new agent-browser page-command compatibility beyond the existing `0.33.0` matrix.

## Decisions

### 1. Extend the existing workspace record with an optional working directory

`ConversationWorkspaceSnapshot` and the Extension-private stored payload gain an optional `cwd`. Draft directory changes use the same expected-revision check and group-wide update used by provider and conversation changes. Related tabs therefore inherit one coherent project selection. Resetting a bound conversation back to a draft preserves its directory, while changing providers in a draft does not discard it.

The Side Panel sends one `workspace.pick-directory` integration request to the Bridge. The Bridge opens a platform-native directory chooser, resolves symlinks, and verifies that the result is an absolute existing directory before returning it. Cancellation returns `path: null` and does not mutate the workspace. A separate revision-checked clear operation removes the directory.

The shared `conversation.start` request gains optional `cwd` and bounded initial-page metadata. The Agent service/provider boundary validates any non-empty `cwd` again before use, so a crafted Extension request cannot bypass the picker validation.

Alternative considered: store the selection only in React local state. Rejected because active-tab restoration, related-tab inheritance, and slow first-send races would let the visible selection diverge from the workspace that creates the conversation.

Alternative considered: use a browser `<input type="file" webkitdirectory>`. Rejected because it exposes file handles/names rather than a stable absolute local path usable by Codex or Qoder.

### 2. Capture initial page metadata at the first-send workspace boundary

`ConversationWorkspaceService` captures the active tab's URL and title after reserving the rendered workspace and includes them in `conversation.start`. The shared context deliberately omits raw Chrome tab ID. URL/title lengths are bounded, and the Bridge redacts credential-like query and fragment values before building provider context.

Codex receives the project and initial-page guidance in `thread/start` developer instructions. Qoder ACP does not expose an equivalent developer-instruction field, so its session stores one pending initial-context block and prepends it only to the first provider prompt while the Extension keeps the user's optimistic display text unchanged. Both variants state that paths, URLs, titles, selectors, and DOM-derived values are untrusted metadata.

Alternative considered: prepend the context in the Extension for every provider. Rejected because it would be persisted and rendered as part of the user's message history and would make provider-specific display behavior harder to control.

Alternative considered: include the raw Chrome tab ID exactly as Mearl does. Rejected because agent-browser operates on opaque relay target IDs and RFC-0001 explicitly keeps raw Chrome IDs inside the Extension.

### 3. Inject a Mearl-aligned isolated page-comment runtime only after authorization checks

The background uses `chrome.scripting.executeScript` with an import-free installer function in every currently reachable frame of the active tab. Chrome authorization remains the gate: inaccessible or unauthorized frames are skipped or fail closed, while the top document remains required. Each frame installs one idempotent isolated-world runtime with:

- one-shot selection on a single Side Panel click and continuous selection on a double click;
- one persistent animated highlight that follows pointer or touch selection;
- a compact Shadow DOM editor anchored to the selected element, with visual-viewport edge avoidance and an expandable and draggable style panel;
- the resolved Side Panel light/dark palette, direct native color controls paired with editable CSS values, and coarse-pointer control sizing;
- live, reversible previews for bounded text and CSS style annotations;
- editable pencil markers and compact Side Panel annotation pills;
- bounded element evidence (tag, stable selector/path hints, visible text, rectangle, viewport, page URL/title); and
- runtime messages for add/update/remove/mode changes.

The Side Panel resolves its configured theme before starting comment mode and passes only `light` or `dark` to the page runtime. Touch selection mirrors Mearl's mobile-emulation behavior: it disables page touch scrolling only while the picker is active, updates the existing highlighter through `elementFromPoint` on touch movement, and confirms on touch release. The editor observes `visualViewport` resize and scroll events so virtual keyboards and emulated-device viewport offsets constrain placement.

Frames coordinate with an Extension-private random token so only the frame under the pointer or touch keeps a picker highlight. Opening an editor pauses selection in every installed frame, and continuous-mode completion resumes them together. Element records use the sanitized top document as page evidence and add bounded frame URL, title, and viewport evidence only for a subframe selection; raw Chrome frame IDs never leave the Extension.

The confirmation action uses the inline path and stroke attributes of the repository's locked Lucide `Check` icon instead of a font glyph. If the currently edited annotation is removed, the runtime tears down its editor and target highlight before removing the marker and restores the element's original styles.

Starting, editing, removing, and clearing comments go through Side Panel requests that resolve the active tab and re-check current origin authorization. The runtime never acquires a control lease and never invokes CDP. Chrome restricted pages, missing host permission, navigation, tab closure, unrelated active-tab changes, and permission revocation end or invalidate the comment session.

Pending comment records stay only in the live Side Panel controller. The composer shows them before send and allows edit/removal. On send, a pure formatter turns them into a delimited `Browser comments` block that distinguishes user text from page-derived evidence. The optimistic timeline uses a compact display summary. Successful send clears state and markers; failed send keeps both.

Alternative considered: route element selection through agent-browser/CDP. Rejected because comments are direct user interaction, must work before an Agent owns control, and must not create a control lease.

Alternative considered: a permanently active content script. Rejected because dynamic, user-initiated injection minimizes page residency and naturally fails when optional host permission is absent.

### 4. Carry pasted images as bounded provider-neutral inputs

The composer extracts clipboard file items only when they are images; ordinary text paste remains native. It stores temporary base64 image inputs with an Extension-only preview identifier and byte count, renders 48-pixel removable thumbnails, allows image-only sending, and preserves the selection after a failed send.

The shared protocol carries only `{ data, mimeType, name? }`, with limits of four images, 10 MiB per image, and 20 MiB total. The Extension rejects unsupported providers and obvious limit violations early; the Bridge repeats MIME, base64, count, name, and decoded-byte validation before handing data to a provider. Codex maps images to `turn/start` data URLs. Qoder maps images to ACP image content blocks only when its negotiated `promptCapabilities.image` is true. Image bytes are not written to workspace state, conversation previews, logs, or comment evidence.

Alternative considered: turn clipboard images into temporary filesystem paths. Rejected because it creates cleanup and path-disclosure obligations and is unnecessary for either provider protocol.

Alternative considered: rely only on UI validation. Rejected because a crafted Extension request could bypass the limits and send an unexpectedly large Native Messaging payload.

### 5. Keep automatic approval in the Side Panel controller

The Extension stores a boolean preference in `chrome.storage.local`, defaulting to `false`. The controller evaluates only normalized `approval.requested` events for the currently displayed conversation. When enabled it chooses `accept` only if that exact decision is offered, tracks in-flight approval IDs to prevent duplicate responses, and uses the existing `conversation.respond` path.

Turning the mode on also evaluates currently visible pending approval cards. Requests without one-shot acceptance remain manual; Panerelay never substitutes `acceptForSession`. A failed response leaves actionable feedback and reports the provider error. Because browser permission and lease flows are different message families, they are structurally outside automatic Agent approval.

Alternative considered: set Codex `approvalPolicy: never` or a Qoder provider-wide equivalent. Rejected because that would erase normalized approval visibility, behave differently across providers, and widen trust beyond the current Side Panel controller.

Alternative considered: automatically choose session-wide acceptance. Rejected because the user asked to automate requests, not permanently weaken a provider session's policy.

### 6. Preserve compatibility and ownership documentation

RFC-0001 will state that selected working directories and page-context attachments are untrusted context, not authority, and that automatic approval covers provider requests only. The `agent-browser-0.33.0` document will classify directory selection, initial page context, comments, and auto approval as `Automated` until a daily-Chrome acceptance pass is completed. Connection/page automation and target-lifecycle rows remain unchanged.

### 7. Keep target bootstrap virtual until substantive page work

agent-browser creates a flattened page session and sends page-scoped `Target.setAutoAttach` when it observes a new target. That command configures future child-target routing; it does not itself read, navigate, or interact with the document. The Bridge therefore stores the latest auto-attach parameters while a target is still virtual and acknowledges the setup without asking the Extension to attach Chrome's debugger.

The first substantive page command triggers the existing lazy debugger attachment. While holding the target's FIFO command slot, the Bridge replays the stored auto-attach setup with `waitForDebuggerOnStart` disabled, then forwards the requested page command. Detach resets the applied marker so a later attachment replays the setup. The Extension excludes Target-domain setup and `Runtime.runIfWaitingForDebugger` from favicon activity, while reads, navigation, and interaction still mark the current document.

This preserves RFC-0002's virtual-target intent and child-session compatibility while ensuring that merely opening, discovering, or initializing a tab does not increase the controlled-tab count or modify its favicon.

## Risks / Trade-offs

- **[Risk] A page may move or replace a commented element before send.** → Capture bounded evidence at comment time, keep the marker tied to the original node for editing, and describe the evidence as a snapshot rather than a live selector guarantee.
- **[Risk] Page CSS can conflict with overlays.** → Render editor and markers in Shadow DOM with maximum extension z-index and isolated styles.
- **[Risk] Touch selection can scroll or activate the underlying page.** → Use non-passive touch listeners only while selection is active, suppress the completing gesture, and restore page touch behavior when the picker pauses.
- **[Risk] URL metadata can contain secrets.** → Bound length, redact credential-like query/fragment values in the Bridge, never log the context, and omit unreadable metadata.
- **[Risk] Qoder's initial context is delivered with the first prompt rather than session creation.** → Keep it provider-internal, one-shot, and covered by adapter tests so observable Agent orientation matches Codex.
- **[Risk] Clipboard images can make Native Messaging requests large.** → Bound count and decoded bytes in both Extension and Bridge, reuse chunked transport, and never retain base64 in previews or diagnostics.
- **[Risk] Deferring page-scoped auto-attach could lose iframe or worker discovery.** → Replay the latest setup before the first substantive command under the same per-target FIFO slot and reset it after detach.
- **[Risk] A stale Side Panel could attach a directory or context to the wrong tab.** → Reuse expected workspace revisions, capture the tab once per operation, and reject stale commits.
- **[Trade-off] Chrome can inject only into frames covered by current host permissions.** → Keep the top page usable, coordinate every reachable frame, and leave inaccessible cross-origin frames untouched rather than widening site authorization.
- **[Trade-off] Automatic approval is a global local preference.** → Keep a persistent visible indicator and apply it only to the currently displayed Side Panel conversation.

## Migration Plan

1. Add optional protocol fields and Bridge handling in a backward-compatible lockstep workspace release.
2. Extend the existing `conversationWorkspacesV1` record validator with optional `cwd`; records written by previous builds remain valid.
3. Add the Side Panel controls, Mearl-aligned comment runtime, bounded image input, and default-off automatic-approval state.
4. Update RFC and compatibility documentation, then run protocol, Bridge, Extension, OpenSpec, and full workspace validation.
5. Rollback ignores/removes the optional `cwd` field, stops injecting the comment runtime, and leaves provider-native conversations and Chrome authorization untouched.
