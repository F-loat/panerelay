## Context

See `proposal.md` for motivation. The existing website is a static Vite application deployed below the `/panerelay/` GitHub Pages path, with English as its no-JavaScript landing-page baseline and client-side Simplified Chinese localization. The new comparison content must improve discovery without weakening the accepted authorization, control, protocol, or browser-ownership decisions in RFC-0001 and RFC-0002. Compatibility terminology and baselines remain governed by `docs/compatibility/`.

## Goals / Non-Goals

**Goals:**

- Publish crawlable English and Simplified Chinese comparison URLs with neutral, source-linked claims.
- Reuse the website's visual system while keeping comparison pages readable without JavaScript.
- Add durable repository launch assets that an operator can adapt without recreating positioning or claims.
- Make SEO changes inspectable through static metadata, sitemap entries, semantic content, and build tests.

**Non-Goals:**

- Change Extension permissions, authorization behavior, the Bridge policy boundary, control leases, target lifecycle, or automation-engine semantics.
- Claim ownership of browser profiles, browser processes, proxies, isolated contexts, or upstream installation behavior.
- Add analytics, a CMS, a publishing bot inside the repository, social-network credentials, or automatic browser actions to the product.
- Reclassify Edge `Forwarded` groups, widen supported integration surfaces, or move agent-browser from its accepted 0.33.0 minimum.

## Decisions

### Build two static localized comparison entries

Add `compare/index.html` for English and `zh-CN/compare/index.html` for Simplified Chinese as explicit Vite HTML inputs. Both pages contain complete localized HTML and use ordinary links for locale switching, so crawlers and no-JavaScript visitors do not depend on runtime translation.

Alternative considered: one dynamically translated comparison URL. Rejected because English-only source HTML would weaken Chinese discovery and make alternate-language metadata less precise.

### Reuse first-party styles through a small comparison entry

The comparison pages load a small TypeScript entry that imports the established website styles plus comparison-specific CSS. Page content and navigation remain functional without that script; the entry exists only to participate in the build and enable the same progressive mobile navigation behavior when useful.

Alternative considered: duplicate all shared CSS and navigation markup into a separate microsite. Rejected because it would drift from the primary website and increase maintenance cost.

### Compare connection approaches, not brands as winners and losers

The page compares four approaches: Panerelay, managed or isolated automation browsers, raw CDP attachment, and the Playwright Chrome Extension. Claims are limited to user-visible connection and authorization characteristics supported by official Chrome and Playwright documentation plus checked-in Panerelay evidence. Browser Use and agent-browser appear as integrations and source context, not as targets for adversarial ranking.

Alternative considered: a conversion-oriented feature checklist with Panerelay winning every row. Rejected because different approaches serve different goals and such a table would obscure meaningful browser-ownership and security trade-offs.

### Keep evidence and reusable copy in repository marketing documents

Add a compact marketing index, launch drafts, community playbook, SEO content map, and claim register under `docs/marketing/`. Public pages link directly to primary sources; the repository documents also record acceptable wording, wording to avoid, and the date each current upstream claim was checked.

Alternative considered: keep drafts only in task history. Rejected because task history is not a reviewable, versioned product source of truth.

### Test the production artifact, not only source strings

Extend website tests to require both localized HTML outputs, correct relative assets, canonical and alternate-language URLs, comparison links from the landing page, sitemap coverage, JSON-LD, neutral wording, and primary evidence links. Tests also reject analytics and misleading universal-winner language.

## Risks / Trade-offs

- [Upstream comparison facts change] → Date the claim register, link primary sources, and require re-verification before reuse.
- [Separate localized HTML can drift] → Keep both pages structurally parallel and assert shared evidence, rows, actions, and metadata in tests.
- [Comparison language becomes combative] → Compare best-fit contexts and constraints, include an explicit “choose another approach when” section, and prohibit universal superiority claims.
- [SEO work creates thin duplicate pages] → Publish only two locale-specific canonical pages for one clear intent and keep future keyword ideas in the content map until they justify distinct content.
- [Static multi-page output breaks project-path links] → Use Vite HTML inputs with relative built assets and test every emitted page from `dist/`.

## Migration Plan

1. Add localized comparison inputs, shared entry/CSS, landing links, sitemap entries, and metadata.
2. Add repository marketing assets and evidence register.
3. Run focused source/build tests, strict OpenSpec validation, full workspace checks, and `git diff --check`.
4. After merge, deploy through the existing main-branch Pages workflow and verify both production locale URLs at desktop and 375-pixel widths.

Rollback is removal of the comparison inputs, links, and sitemap entries; the existing landing page and deployment workflow remain independently usable.
