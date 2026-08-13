## Why

Panerelay's Zhihu adapter can read articles and interact with them, but it cannot create, revise, publish, or remove article drafts even though the signed-in Zhihu web editor exposes fetch-shaped endpoints for those workflows. A bounded live probe is needed now to distinguish fetch-compatible article operations from editor-only signing behavior before expanding the public command surface.

## What Changes

- Add a reproducible, privacy-bounded Zhihu article-editor spike that records the current draft and publish endpoints, required request metadata, and whether the operations work through Browser Fetch directly or with an adapter-local deterministic signer.
- Add guarded Zhihu commands for creating an article draft, reading it, updating it, and deleting a private draft. Keep publication and published-article updates Unsupported until their public outcomes can be exercised intentionally and verified synchronously.
- Require `--execute` for every article mutation, verify the signed-in author and returned article identity, and fail closed on ownership, challenge, review, ambiguous outcome, or unsupported signature requirements.
- Extend tests and the OpenCLI migration compatibility record with the exact verified subset and retain unsupported published-article deletion, media upload, paid-column, scheduling, and page-editor-only behavior explicitly.
- Permit a clean-room, adapter-local `x-zst-81` implementation if a future endpoint requires it and it can be derived from observed first-party web code, uses only request-known or non-secret inputs, and is covered by sanitized fixtures and drift detection. The verified private-draft endpoints currently do not require that header.
- Do not copy generated signatures from a page, expose Cookie values to the adapter, execute page JavaScript at runtime, add DOM automation, tab authorization, browser control, CAPTCHA bypass, article editing through agent-browser, or browser-process capabilities. The existing agent-browser 0.33.0 compatibility groups remain unchanged.

## Capabilities

### New Capabilities

- `zhihu-site-adapter`: Define the bounded read, draft, publish, update, deletion, authorization, ownership, and fail-closed behavior of Panerelay's built-in Zhihu adapter.

### Modified Capabilities

<!-- None. This change adds a site-specific contract without changing the generic fetch-adapter protocol. -->

## Impact

- Affects `packages/sites/src/zhihu`, its generated built-in adapter artifact and tests, `packages/sites/e2e`, `docs/spikes`, and `docs/compatibility/opencli-site-migration.md`.
- Adds `https://zhuanlan.zhihu.com` to the adapter's declared origin authority only if the fetch-only draft probe succeeds; users must still grant that domain and Chrome Host Permission independently.
- Does not change the Bridge, Extension, protocol, Browser Fetch authority model, automation engines, or browser ownership. RFC-0009 and RFC-0010 remain authoritative.
