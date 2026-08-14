## Context

RFC-0009 defines the out-of-process Site Adapter and fetch-session boundary. RFC-0010 limits an adapter to declared exact origins and manifest-owned protected bindings while keeping Cookie and storage values inside the Extension. The existing Zhihu adapter supports private article-draft CRUD and top-level comment creation. Its main specification already reserves `article-publish` for a future implementation that proves both first publication and published-article update.

Live use on 2026-08-14 established that the editor publishes through `POST https://www.zhihu.com/api/v4/content/publish`, the current comment UI offers deletion but no edit control for an owned comment, and public articles remain fully readable through `GET https://zhuanlan.zhihu.com/api/articles/<id>`. The alternative `/api/v4/articles/<id>` read currently rejects unsigned requests with code `10003`.

## Goals / Non-Goals

**Goals:**

- Determine the exact fetch-compatible request and verification paths for first publication, published-article update, owned-comment update, and owned-comment deletion.
- Expose every verified path as a separate guarded command with explicit intent and stable output.
- Keep dynamic signing site-local, deterministic, fixture-covered, and independent of exported browser credentials.
- Use disposable comments and controlled owned article changes for daily-Chrome verification, with cleanup or restoration in `finally`.

**Non-Goals:**

- Copy a live signature from a page, execute Zhihu page JavaScript at runtime, or let a Site command navigate or control a tab.
- Broaden generic protected bindings, disclose Cookie or storage values, or patch an external dependency.
- Add scheduling, media upload, cover selection, paid-column, contribution, review bypass, CAPTCHA handling, or public-article deletion without separate evidence.

## Decisions

### Spike before exposing each command

The spike records endpoint families, request-field names, response states, verification endpoints, and bounded failure conclusions. It retains no Cookie, live signature, article body, comment body, screenshot, or machine-specific identifier. Each command is independently gated: an unsupported publish signer does not block verified comment operations.

### Preserve the RFC-0010 authority boundary

A dynamic signer may be implemented only when its inputs are the request method, canonical URL, body, timestamp, public constants, or other non-secret values already available to the adapter. A signer that requires a Cookie, storage value, page runtime value, or captured live result remains unsupported until a separate RFC explicitly expands protected computation.

### Make ownership and verification mandatory

`comment-update` and `comment-delete` first read the current account and target comment, then reject an author mismatch. Update requires bounded non-empty inline text and reads the comment back to compare content. Delete verifies that the comment is no longer readable. `article-publish` reads the owned draft before mutation and validates the same article ID, author, public URL, and published state after mutation.

### Keep mutation intent explicit

`article-publish`, `comment-update`, and `comment-delete` are separate write commands and all require `--execute`. `article-publish` distinguishes a first publication from an update and does not silently schedule, contribute, or submit ambiguous review work.

### Retain only the compatible subset

The owned-comment delete path is `DELETE /api/v4/comment_v5/comment/<id>`. It succeeds with Browser Fetch Cookies and the existing `_xsrf` binding. Newly created comment detail reads can briefly return 5xx, and deletion visibility can lag, so the retained command uses bounded read-only retries before ownership validation and after deletion. Authentication and authorization failures are never retried.

There is no verified same-ID comment edit action in the current desktop UI or its action bundle. `comment-update` remains omitted and is not emulated by deleting and recreating a comment.

First publication and a published-article update both completed through the browser editor, but the requests carried browser-generated `x-zse-93`, `x-zse-96`, and/or `x-zst-81` values. An unsigned Site request for the published draft update failed while the corresponding editor request succeeded. Because the required protected computation is not available under RFC-0010, `article-publish` remains omitted even though the public outcome can be verified through the fetch-compatible article endpoint.

The same spike found that the current pin-comment request uses an encoded body and `x-zse-83`. The legacy plain-JSON endpoint failed, so pin comment creation is not added to the Site command surface.

## Risks / Trade-offs

- [Zhihu signing code changes] → Retain sanitized deterministic fixtures, validate the server envelope, and fail closed on drift.
- [A signer needs protected browser state] → Document that exact path as Unsupported and stop before changing RFC-0010.
- [Comment update is not supported upstream] → Omit `comment-update`; do not emulate it with delete-and-create because that changes identity and timestamps.
- [A publication enters review or challenge] → Report pending/failed without claiming public success.
- [Live verification changes public content] → Use the already-authorized owned article, apply a bounded reversible marker only when necessary, and restore it before completing the spike.

## Migration Plan

Setup rebuilds and reinstalls the lockstep Zhihu adapter. Existing origin grants remain valid. Rollback reinstalls the prior artifact and removes only the newly exposed commands; it changes no browser permissions or user content.
