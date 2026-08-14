# Zhihu Site Adapter Specification

## Purpose

Define the user-visible Zhihu Site Adapter contract for complete content reads and guarded article-draft mutations that reuse an explicitly authorized browser login without exposing browser credentials or depending on page automation.

## Requirements

### Requirement: Zhihu article authority remains bounded

The built-in Zhihu adapter SHALL declare every exact origin used by its article commands and SHALL use only manifest-owned protected bindings for browser state. It MAY generate a dynamic request signature inside the adapter only from request-known or non-secret inputs using a deterministic implementation covered by sanitized compatibility fixtures. It SHALL NOT export Cookie values, copy a generated signature from a page, persist or log signature material, execute page JavaScript at runtime, navigate a tab, or acquire browser control. Revoked domain permission, missing Chrome Host Permission, missing login state, ownership mismatch, signer drift, or a signature that requires protected values unavailable inside the adapter MUST fail before a successful mutation is reported.

#### Scenario: User has not authorized the article editor origin

- **GIVEN** an article command requires `https://zhuanlan.zhihu.com`
- **AND** its Panerelay domain grant or Chrome Host Permission is absent or revoked
- **WHEN** the caller invokes the command
- **THEN** the request fails without creating, updating, publishing, or deleting an article draft

#### Scenario: Adapter generates a supported dynamic signature

- **GIVEN** the current Zhihu article endpoint requires a signature derived entirely from the bounded request and non-secret compatibility inputs
- **WHEN** Panerelay issues the article request
- **THEN** the adapter generates the header deterministically for that request without reading a page or receiving a browser credential
- **AND** sanitized fixtures detect incompatible upstream algorithm drift

#### Scenario: Signature requires unavailable protected state

- **GIVEN** the current Zhihu signature requires a Cookie, storage value, page runtime value, or generated signature that RFC-0010 does not expose to the adapter
- **WHEN** Panerelay prepares the article request
- **THEN** the adapter fails explicitly without exporting, persisting, logging, or replaying that value
- **AND** compatibility documentation does not classify that mutation as supported

### Requirement: Zhihu article drafts have a guarded lifecycle

When live fetch evidence confirms the current endpoint is compatible with RFC-0010, the built-in Zhihu adapter SHALL expose `article-create`, `article-draft`, `article-update`, and `article-delete` commands for private article drafts. Mutations SHALL accept bounded inline title or HTML content, require `--execute`, resolve only numeric article IDs, typed article targets, or canonical Zhihu article URLs, and verify the returned draft identity and current signed-in author. `article-delete` SHALL reject a published article and SHALL verify that the private draft is no longer readable after deletion.

#### Scenario: Caller creates a private article draft

- **GIVEN** a valid signed-in Zhihu browser session with both declared origins authorized
- **WHEN** the caller supplies a non-empty bounded title and content to `article-create --execute`
- **THEN** the adapter creates a private draft and returns its numeric ID, title, state, author identity, and canonical editor URL
- **AND** it reads the created draft back before reporting success

#### Scenario: Caller reads or updates an owned draft

- **GIVEN** the target resolves to an article draft owned by the current signed-in account
- **WHEN** the caller invokes `article-draft`, or supplies at least one changed title or content value to `article-update --execute`
- **THEN** the adapter returns the complete current draft fields or applies and reads back the requested update
- **AND** it does not replace an omitted title or content field

#### Scenario: Caller omits mutation confirmation

- **GIVEN** an article create, update, publish, or delete request
- **WHEN** `--execute` is absent or false
- **THEN** the adapter fails before issuing the mutating request

#### Scenario: Caller targets another author's article

- **GIVEN** the resolved article or draft author does not match the current signed-in account
- **WHEN** the caller invokes an article mutation
- **THEN** the adapter fails before issuing the mutating request

#### Scenario: Caller deletes a draft

- **GIVEN** the target is an owned private draft rather than a published article
- **WHEN** the caller invokes `article-delete --execute`
- **THEN** the adapter deletes that draft, verifies its absence, and returns the deleted draft ID

### Requirement: Zhihu article publishing is explicit and verified

When live fetch evidence confirms the current endpoint is compatible with RFC-0010, the built-in Zhihu adapter SHALL expose `article-publish` as a guarded write command. The command SHALL distinguish first publication from an update to an already published article, SHALL send only bounded explicitly supplied settings, and SHALL verify the returned article ID, author, public URL, and published state before reporting success. Review, challenge, scheduling, paid-column, contribution, attachment, image upload, and ambiguous asynchronous outcomes SHALL fail closed or remain unsupported. A dynamic signature MAY be implemented only when every signer input is request-known or non-secret and sanitized deterministic fixtures detect drift; a signature requiring unavailable protected browser state SHALL keep that exact flow unsupported.

#### Scenario: Current publication flow lacks bounded live evidence

- **GIVEN** live verification has passed only for private-draft create, read, update, and delete
- **WHEN** Panerelay builds the Zhihu command catalog
- **THEN** the catalog does not expose `article-publish`
- **AND** publication and published-article updates remain documented as Unsupported

#### Scenario: Caller publishes a private draft

- **GIVEN** an owned private draft with a non-empty title and sufficient content
- **WHEN** the caller invokes `article-publish --execute`
- **THEN** the adapter requests first publication and returns the canonical public article URL only after the same article ID and author are readable as published

#### Scenario: Caller publishes changes to an existing article

- **GIVEN** an owned published article has a pending editable draft
- **WHEN** the caller invokes `article-publish --execute`
- **THEN** the adapter requests an article update rather than a second first publication
- **AND** it verifies the same public article identity and current published state after the operation

#### Scenario: Publication outcome is not synchronously verifiable

- **GIVEN** Zhihu accepts an article for review, schedules it, challenges the account, requires unavailable protected signer state, or returns no stable published identity
- **WHEN** the publish request completes or is prepared
- **THEN** the adapter reports a pending or failed outcome without claiming that the article is publicly published

### Requirement: Owned Zhihu comments have guarded mutations

The built-in Zhihu adapter SHALL independently expose each owned-comment mutation only when live fetch evidence confirms that exact endpoint is compatible with RFC-0010. A retained command SHALL require `--execute`, accept only numeric comment IDs or canonical supported comment targets, verify ownership before mutation, and verify the resulting content or absence before reporting success. The adapter SHALL NOT emulate an update by deleting and recreating a comment.

#### Scenario: Caller updates an owned comment

- **GIVEN** a comment is owned by the current signed-in account
- **WHEN** the caller supplies bounded non-empty inline text to `comment-update --execute`
- **THEN** the adapter updates the same comment identity
- **AND** it reads the comment back and verifies the requested content before reporting success

#### Scenario: Caller deletes an owned comment

- **GIVEN** a comment is owned by the current signed-in account
- **WHEN** the caller invokes `comment-delete --execute`
- **THEN** the adapter deletes the comment and verifies that the same comment ID is no longer readable
- **AND** transient 5xx detail reads or delayed deletion visibility use only bounded read-only retries

#### Scenario: Caller targets another author's comment

- **GIVEN** the target comment author does not match the current signed-in account
- **WHEN** the caller invokes a comment mutation
- **THEN** the adapter fails before issuing the mutating request

#### Scenario: Upstream does not support stable comment editing

- **GIVEN** Zhihu exposes no verified same-identity comment update request
- **WHEN** Panerelay builds the Zhihu command catalog
- **THEN** `comment-update` remains omitted and documented as Unsupported
- **AND** Panerelay does not silently replace the comment with a new ID

### Requirement: Zhihu article compatibility evidence is conservative

Automated tests SHALL cover target parsing, command metadata, `--execute`, ownership, request method and body, deterministic signature fixtures when applicable, response validation, and fail-closed errors without retaining credentials or real article content. Compatibility records SHALL classify only the exact article commands exercised through a matching installed adapter and an existing Chrome session as Verified or Forwarded, and SHALL keep public-article deletion, media workflows, editor-only settings, and any signature path that depends on unavailable protected state Unsupported.

#### Scenario: Live article verification completes

- **GIVEN** a disposable private draft and a matching local Panerelay build
- **WHEN** the draft create, read, update, and cleanup sequence runs in daily Chrome
- **THEN** the compatibility record retains only command names, bounded status conclusions, versions, and cleanup outcome
- **AND** it retains no Cookie, signature, request body, draft title, draft content, screenshot, or machine-specific identifier
