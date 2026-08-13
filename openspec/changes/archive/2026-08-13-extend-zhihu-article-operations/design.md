## Context

See [proposal.md](./proposal.md) for motivation. RFC-0009 defines the site-adapter process and invocation boundary; RFC-0010 defines exact-origin fetch authority and protected browser-state bindings. The current Zhihu adapter declares only `https://www.zhihu.com`, injects the `_xsrf` Cookie into `x-xsrftoken`, and supports article reads and article interactions but not the editor lifecycle.

A 2026-08-13 probe of the signed-in daily Chrome editor observed these first-party requests:

- `GET`, `PATCH`, and `DELETE https://zhuanlan.zhihu.com/api/articles/<id>/draft`;
- `POST https://zhuanlan.zhihu.com/api/articles/drafts` for initial draft creation;
- `POST https://www.zhihu.com/api/v4/content/publish` with `publish` and `update` actions;
- `_xsrf`, `x-requested-with`, and a dynamic `x-zst-81` header on editor draft writes.

The fetch-only disposable-draft spike answered that question for the private-draft subset: create, read, update, verify, and delete all succeeded without `x-zst-81`. No signer is included in this change.

## Goals / Non-Goals

**Goals:**

- Express the compatible article draft and publication lifecycle through ordinary Site Adapter fetch calls, including an adapter-local deterministic signer when it needs no protected browser value.
- Preserve exact-origin permission, Extension-private Cookie binding, explicit write confirmation, ownership checks, response verification, and cleanup.
- Record reproducible endpoint and compatibility conclusions without retaining article content or credentials.

**Non-Goals:**

- Execute Zhihu page JavaScript at runtime, copy a generated signing value from a page, or expose a protected browser value to an adapter-side signer.
- Turn a fetch command into navigation, DOM automation, tab authorization, or agent-browser behavior.
- Support media upload, local-file import, cover selection, scheduling, paid columns, contribution review, content monetization, or public-article deletion without separate evidence.

## Decisions

### Gate production commands on a disposable draft probe

The source-form adapter probe declared both exact origins and the existing `_xsrf` binding, then created, read, updated, and deleted one clearly labelled private draft with cleanup in `finally`. The unsigned sequence passed, establishing that `x-zst-81` is not required for the retained draft commands as of 2026-08-13.

This is preferred to probing an existing published article because a failed or delayed update can change public content or review state. It is also preferred to assuming an observed request header is mandatory.

### Allow a clean-room adapter-local signer with strict input limits

If a future retained endpoint makes `x-zst-81` mandatory and the current first-party implementation derives it only from the request method, URL, body, timestamp, public constants, or other non-secret inputs already available to the adapter, Panerelay may implement the minimal deterministic transformation in the Zhihu adapter. The current draft implementation deliberately has no unused signer.

The signer must not depend on a Cookie, local storage value, DOM state, page execution, copied generated value, or a patched external dependency. If it does, this change stops and documents the missing protocol capability rather than passing protected state to the child. This preserves RFC-0010's credential boundary while accepting the maintenance cost the user explicitly approved.

Alternatives considered:

- Capturing a fresh header from an open editor page was rejected because it couples Fetch to a controlled tab and replays browser-generated state.
- Adding arbitrary caller-defined header bindings was rejected because it weakens RFC-0010's manifest-owned binding model.
- Extending the Extension to run site-specific signer code was rejected because it moves site semantics across the shared protocol boundary.

### Keep article targets and lifecycle commands explicit

The adapter uses `article:<numeric-id>` and canonical `https://zhuanlan.zhihu.com/p/<id>` targets. `article-create`, `article-update`, `article-publish`, and `article-delete` are separate write commands, each guarded by `--execute`; `article-draft` is read-only. Separate commands keep CLI help, access classification, and Agent intent auditable instead of hiding multiple mutations behind one action flag.

Alternatives considered:

- A single `article --action ...` command was rejected because it weakens command-level access metadata and makes accidental publication easier.
- Reusing `download` for draft reads was rejected because `download` promises a published article converted to inline Markdown, not editable draft state.

### Add the editor origin without changing generic fetch authority

If the probe succeeds, the site manifest adds `https://zhuanlan.zhihu.com` and extends the existing `_xsrf` header binding to that exact origin. The adapter must use canonical non-redirecting endpoints. Users authorize the new domain separately; neither setup nor the adapter grants it automatically.

No Bridge, Extension, protocol, or Browser Fetch change is planned. A signature that cannot be computed without protected page or browser state remains Unsupported in this adapter boundary.

### Verify ownership and outcome around every mutation

Before update, publish, or delete, the adapter reads the current account and target draft, compares stable author identity, validates lifecycle state, and rejects mismatches. After create or update it reads the draft back; after delete it requires the draft to be absent; after publish it reads the public article and checks the same ID and author. Responses that indicate review, challenge, asynchronous processing, or ambiguous identity do not become `success` rows.

### Keep publication Unsupported while draft CRUD is verified

Mocked tests prove deterministic parsing and fail-closed behavior, not upstream compatibility. Two successful create/read/update/delete cleanup sequences in daily Chrome provide live evidence for the private-draft subset. Publication and published-article update remain Unsupported until each is exercised intentionally with a controlled public artifact and synchronously verified. Edge inherits only the shared implementation as Forwarded.

## Risks / Trade-offs

- [Zhihu changes undocumented editor endpoints] → Validate envelopes strictly, document the evidence date, and fail closed on drift.
- [The dynamic signature is mandatory and drifts] → Keep the signer site-local, retain synthetic fixtures and explicit version evidence, detect malformed/rejected responses, and fail closed until the adapter is updated.
- [The signer needs protected browser state] → Stop at the spike result and discuss a separate RFC-level authority change instead of exporting the value or broadening bindings implicitly.
- [Cleanup fails after creating a draft] → Report the retained draft ID only to the invoking user, leave it private, and do not claim the spike fully passed; never retry deletion blindly.
- [Publish enters review or returns asynchronously] → Return a pending/failed outcome and require a later read to establish public state.
- [Adding the editor origin increases requested authority] → Declare the exact origin in the manifest and rely on independent, revocable Panerelay and Chrome grants.
- [A caller overwrites content unintentionally] → Preserve omitted fields, require a non-empty change set and `--execute`, and read back the result.

## Migration Plan

Setup rebuilds and reinstalls the lockstep `zhihu` built-in after release. Existing `www.zhihu.com` grants remain valid; article-editor commands require a separate `zhuanlan.zhihu.com` grant. Rollback reinstalls the prior adapter artifact and removes the new commands without changing stored browser permissions or other adapters.
