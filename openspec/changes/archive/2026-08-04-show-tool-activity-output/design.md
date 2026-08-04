## Context

See [proposal.md](./proposal.md) for motivation and the delta specs for observable behavior. `ConversationActivity` currently has only `title`, optional `detail`, and status. The Side Panel disclosure renders those fields correctly, but the shared ACP adapter extracts text tool content only when a tool fails. Qoder and OpenCode successful content therefore disappears at the Bridge even when ACP marks it as displayable.

ACP tool updates can also contain images, diffs, terminal references, raw input/output values, and arbitrary metadata. Panerelay's provider-neutral boundary must not forward those native objects merely to make the disclosure richer. No accepted RFC needs amendment because the change is additive conversation presentation and does not alter browser attachment, authorization, control, protocol identity, or provider ownership.

## Goals / Non-Goals

**Goals:**

- Carry one bounded, displayable text result separately from the activity title and failure diagnostic.
- Preserve ACP patch semantics when a completion update omits content already received on an earlier update.
- Keep compact activity cards quiet and reveal output only after the user expands a terminal activity.
- Cover Qoder and OpenCode through their shared ACP normalization path without changing other provider behavior.

**Non-Goals:**

- Do not serialize `rawOutput`, infer display text from arbitrary objects, render images or diffs, or implement ACP terminal embedding/output retrieval.
- Do not persist a new Bridge-side activity transcript or add output to external browser-control activity journals.
- Do not classify unexecuted real-provider behavior as `Verified`; deterministic adapter and component tests establish only automated coverage.

## Decisions

### Add `output` beside `detail` in normalized activity

`ConversationActivity` gains optional `output: string`. `detail` retains its existing diagnostic meaning, setup-failure detection, and danger styling. Successful output is not placed in `detail`, because that would make it appear in the compact summary, apply failure-oriented semantics to normal results, and couple setup-error handling to ordinary stdout.

Using a separate event type was rejected because output belongs to the same correlated tool lifecycle and would require a second ordering and replacement model in the Extension. Reusing assistant messages was rejected because tool output is not an Agent answer and should remain on-demand.

### Accept only explicit ACP text content

The shared ACP adapter joins non-empty `content` entries whose nested display block is text and bounds the result to the existing 8 KiB activity-detail limit. It never inspects `rawInput`, `rawOutput`, `_meta`, image data, diff structures, terminal IDs, or unknown provider fields.

For a failed terminal update, displayable text continues to become diagnostic `detail`. For a completed terminal update, it becomes `output`. While a tool is running, a text content update may be retained in normalized state so a later completion update that omits `content` can preserve the latest value according to ACP patch semantics; the Side Panel still keeps running cards non-expandable. An explicit null or empty content collection clears the retained candidate.

Stringifying `rawOutput` was rejected because ACP deliberately separates a display collection from arbitrary machine output and Panerelay cannot safely infer sensitivity or stable formatting from the raw value.

### Render output only in the expanded terminal disclosure

The existing disclosure remains collapsed by default. Its body renders the full title, then an output section when present, then diagnostic detail when present. Output uses the current wrapped, selectable monospace treatment with a neutral border; failed and declined cards keep danger styling for diagnostic detail without recoloring successful output semantics.

Showing output in the compact row was rejected because command results can contain multiline page/file content and would make normal conversation activity noisy. A nested second disclosure was rejected because the card is already user-expanded and the 8 KiB bound keeps layout manageable.

## Risks / Trade-offs

- [A provider labels sensitive text as displayable ACP content] → Preserve the protocol's explicit display boundary, bound to 8 KiB, keep content user-requested/on-demand, and continue excluding raw and metadata fields.
- [A provider sends large or incremental output] → Replace according to ACP content semantics and bound the normalized joined text rather than accumulating unbounded chunks.
- [A completion update omits prior content] → Retain the previous normalized candidate; clear it only when ACP explicitly replaces content with null or an empty collection.
- [Qoder or OpenCode emits only a terminal handle or raw output] → Show no output rather than implementing a provider-specific workaround; classify that surface as unsupported by this change.

## Migration Plan

1. Add the optional shared protocol field so old events remain valid.
2. Normalize bounded ACP text content for shared Qoder/OpenCode activities with provider tests.
3. Render the new field in the existing disclosure with component and layout regressions.
4. Rollback can stop producing and rendering the optional field without migrating stored state; the Bridge does not persist activity output.
