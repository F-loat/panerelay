# Spike 0011: Zhihu article operations through Browser Fetch

- Date: 2026-08-13
- Status: Verified with matching locally built adapter and daily Chrome
- OpenSpec change: [`extend-zhihu-article-operations`](../../openspec/changes/extend-zhihu-article-operations/)
- Governing RFCs: [RFC-0009](../rfcs/0009-browser-backed-fetch-and-site-adapters.md), [RFC-0010](../rfcs/0010-browser-state-fetch-authority-and-agent-routing.md)

## Question

Can Panerelay create, read, update, and delete a private Zhihu article draft through Browser Fetch, using the user's existing Chrome session and declared protected-value bindings, without executing page JavaScript or returning browser credentials? If the requests require `x-zst-81`, can the header be generated deterministically from request-known, non-secret inputs inside the Zhihu adapter?

## Observed first-party behavior

A read-only inspection of the current Zhihu column editor and its loaded first-party bundle identified these request families:

- `POST https://zhuanlan.zhihu.com/api/articles/drafts` creates a private draft;
- `GET https://zhuanlan.zhihu.com/api/articles/<id>/draft` reads the editable draft;
- `PATCH https://zhuanlan.zhihu.com/api/articles/<id>/draft` updates draft fields;
- `DELETE https://zhuanlan.zhihu.com/api/articles/<id>/draft` deletes a draft;
- `POST https://www.zhihu.com/api/v4/content/publish` handles first publication, published-article updates, and scheduled publication through an action-bearing payload.

The editor's update request carried JSON content, browser Cookies, `x-xsrftoken`, `x-requested-with`, and `x-zst-81`. Reloading an existing owned article editor caused one automatic, unchanged draft save; no publication action was taken.

## Fixture

`fixtures/zhihu-article-operations` is a source-form adapter with two fixed HTTPS origins and one fixed `_xsrf`-to-`x-xsrftoken` binding. Its single guarded command attempts this bounded sequence:

1. create a clearly labelled private test draft;
2. read it back and validate only its identity and draft state;
3. update the title and content with a second fixed marker;
4. read it back and validate that the update is visible;
5. delete it in a `finally` block.

The fixture never publishes. It returns only request-status booleans. If cleanup fails, it reports the transient numeric draft identifier so the operator can remove that draft manually; the identifier is not retained in this report.

## Privacy and implementation constraints

- Declare both request origins and bind `_xsrf` only to those origins.
- Keep Cookies and protected binding values inside the Extension's Browser Fetch path.
- Do not log or retain request bodies, response bodies, Cookies, `_xsrf`, `x-xsrftoken`, generated `x-zst-81` values, browser identifiers, or article identifiers.
- Do not copy a signature produced by a live page or execute Zhihu page JavaScript to obtain one.
- A clean-room adapter-local signer is acceptable only when it is deterministic from request-known or non-secret inputs. It must have sanitized synthetic fixtures and fail closed on shape or algorithm drift.
- Do not retain a production mutation path that depends on protected page runtime state or a cross-package workaround.

## Procedure

1. Keep an authenticated `zhuanlan.zhihu.com` tab open in the daily Chrome profile controlled by Panerelay.
2. Install the local fixture adapter and explicitly approve its declared Zhihu origins if prompted.
3. Run `panerelay zhihu-article-probe probe --execute --json`.
4. Record only the bounded outcome classification below and remove the fixture adapter.
5. If the unsigned request fails specifically because `x-zst-81` is required, isolate the first-party algorithm and inputs using sanitized test vectors before repeating the disposable sequence.

## Evidence

The unsigned source-form probe completed all five bounded stages in the signed-in daily Chrome profile on 2026-08-13: create, read, update, update verification, and deletion. The requests used Browser Fetch Cookies and the manifest-owned `_xsrf` binding; no `x-zst-81` header or adapter-local signer was required.

The matching production Zhihu adapter was then built and installed locally. Its four retained commands completed a second disposable sequence:

- `article-create` returned an owned private draft with `state=draft` and matching requested fields;
- `article-draft` returned the same owned draft;
- `article-update` changed only the title, preserved the omitted content field, and verified both through a read-back;
- `article-delete` rejected non-draft states by construction, deleted the private draft, and verified that a later draft read returned Not Found.

All disposable drafts were deleted. The probe adapter was removed after verification. No request body, response body, Cookie, protected binding value, signature, browser identifier, article identifier, or machine-specific output is retained here.

The current first-party publication endpoint is documented as observed but remains Unsupported in the production adapter: first publication and updates to published articles have not been exercised with a safely disposable public artifact, and their review or asynchronous outcomes are not yet bounded enough to report synchronous success.
