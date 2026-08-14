## Why

Panerelay can create and verify private Zhihu article drafts and can create top-level comments, but it cannot publish a prepared draft, publish changes to an existing article, update an owned comment, or delete an owned comment through the Site Adapter. A live 2026-08-14 use of those flows showed that users must currently fall back to the Zhihu editor or comment menu even though the mutations are first-party fetch-shaped operations.

## What Changes

- Add a privacy-bounded live spike for Zhihu article publication, published-article updates, owned-comment updates, and owned-comment deletion.
- Keep `article-publish` unsupported after verifying that current publication and published-draft writes depend on browser-generated protected headers unavailable to a Site Adapter.
- Add `comment-delete` for owned comments with bounded retry and absence verification; keep `comment-update` unsupported because the current first-party UI exposes no same-ID edit action.
- Fix public-article Markdown export to use the fetch-compatible `zhuanlan.zhihu.com` article endpoint.
- Permit a clean-room, adapter-local dynamic signer derived from first-party code when all required inputs are request-known or non-secret. If signing requires protected browser state unavailable under RFC-0010, keep that exact operation unsupported and document the evidence rather than crossing the authority boundary.
- Require `--execute`, ownership checks, stable identity validation, and post-write verification for every retained mutation.
- Keep review, challenge, scheduling, media upload, paid-column, contribution, public-article deletion, and ambiguous asynchronous outcomes unsupported unless independently exercised and verified.

## Capabilities

### Modified Capabilities

- `zhihu-site-adapter`: Expand the guarded public-article and owned-comment mutation surface based on reproducible live evidence.

## Impact

- Affects `packages/sites/src/zhihu`, its command metadata and tests, the isolated Zhihu E2E path, `docs/spikes`, and `docs/compatibility/opencli-site-migration.md`.
- Does not change the Bridge, Extension, protocol, protected-value binding model, or browser-control ownership. Any discovery that requires such a change stops for an RFC-level decision.
