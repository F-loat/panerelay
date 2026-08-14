# Spike 0012: Zhihu publication and owned-comment mutations

- Date: 2026-08-14
- Status: Comment deletion verified; publication and comment editing bounded as Unsupported
- OpenSpec change: [`expand-zhihu-publishing-and-comments`](../../openspec/changes/expand-zhihu-publishing-and-comments/)
- Governing RFCs: [RFC-0009](../rfcs/0009-browser-backed-fetch-and-site-adapters.md), [RFC-0010](../rfcs/0010-browser-state-fetch-authority-and-agent-routing.md)

## Question

Which current Zhihu article-publication and owned-comment mutation paths can a Site Adapter expose through Browser Fetch without exporting browser credentials, replaying a page-generated signature, or acquiring tab control?

## Sanitized observations

- `GET https://zhuanlan.zhihu.com/api/articles/<id>` returns a complete public article, including content, author, canonical URL, and `published` state. It is the compatible read-back and Markdown-export endpoint.
- `GET https://www.zhihu.com/api/v4/articles/<id>` rejected the equivalent unsigned read with upstream code `10003` and is not used.
- The editor saves changes to an already published article through `PATCH https://zhuanlan.zhihu.com/api/articles/<id>/draft` with `_xsrf` plus a browser-generated `x-zst-81` header.
- First publication and published updates use `POST https://www.zhihu.com/api/v4/content/publish`. The observed published-update request carried `_xsrf`, `x-zse-93`, `x-zse-96`, and `x-zst-81`; its bounded JSON envelope identified an article action and publication data.
- The desktop comment UI exposes deletion but no same-ID edit action for an owned comment. Its current delete path is `DELETE https://www.zhihu.com/api/v4/comment_v5/comment/<id>`.
- Newly created comment detail reads can briefly return 5xx, and deletion visibility can lag. A bounded retry around read-only verification resolved both without retrying permission failures.
- The current pin-comment path is `POST https://www.zhihu.com/api/v4/comment_v5/pins/<id>/comment` with an encoded body and `x-zse-83`. The legacy plain-JSON pin-comment path failed.

No Cookie, protected-header value, request body, article body, comment body, screenshot, browser identifier, or live content identifier is retained in this report.

## Live evidence

A matching locally built adapter in the daily Chrome profile completed two disposable owned-comment cleanup sequences with the retained `comment-delete` implementation. The command required `--execute`, read the current account and comment, confirmed ownership, issued the current delete request, and verified the comment became unreadable. All disposable comments were removed.

The same signed-in profile completed one first publication and one update of a controlled owned public article through the visible editor. Both outcomes were confirmed through the compatible public-article endpoint. The locally installed Site Adapter also read the published draft and exported the updated public article as Markdown.

An unsigned Site update of the published draft failed while the editor request with protected headers succeeded. This establishes public publication and published-draft mutation as incompatible with the current RFC-0010 Site boundary even though their public outcomes are synchronously verifiable.

## Retained conclusions

- `comment-delete`: **Verified** in daily Chrome and retained with ownership checks, explicit execution, transient-read retry, and absence verification.
- Public article read and `download`: **Verified** through the `zhuanlan.zhihu.com` article endpoint.
- `comment-update`: **Unsupported** because no current same-ID edit mutation was found. Panerelay does not emulate it with delete-and-create.
- `article-publish` and published-article Site updates: **Unsupported** because the current requests require browser-generated protected headers unavailable to the adapter. The successful UI flows do not authorize copying or replaying those values.
- Pin comment creation: **Unsupported** in the Site Adapter because the current request requires an encoded body and protected header; the user-authorized live comment was completed through the visible page.

The private-draft commands verified in Spike 0011 remain unchanged: their unsigned create, read, update, and delete subset does not require the protected publication headers.
