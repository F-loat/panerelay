## Context

See `proposal.md` for motivation and `specs/project-website/spec.md` for the updated behavior. The website currently ships separate static English and Simplified Chinese documents for the homepage and comparison route. Each page already exposes ordinary links to the equivalent locale, but the homepage and comparison page use different client entry points and only the homepage marks both language options with a shared data attribute.

This is website-only behavior. Accepted browser attachment, control, ownership, and compatibility decisions in the RFCs are not affected, and no capability status (Verified, Forwarded, Partial, or Unsupported) changes.

## Goals / Non-Goals

**Goals:**

- Use one small client module for locale preference behavior across both website entry points.
- Keep explicit links and complete static documents as the source of locale routing truth.
- Make unavailable storage and malformed values harmless.

**Non-Goals:**

- Run before static HTML is available, remove the possibility of a brief pre-navigation render, or add server-side routing.
- Infer a locale from `navigator.language`, synchronize devices, or change content localization.
- Change browser or Agent permissions, control leases, ownership, or compatibility claims.

## Decisions

### Store only an explicit supported locale

A shared TypeScript module will attach click listeners to links marked with `data-language-option` and store either `en` or `zh-CN` under a Panerelay-specific key. Reads and writes will be wrapped because browsers can deny storage even when the API exists. Unsupported values are treated as no preference.

An alternative was to store a cookie, but the site has no server locale routing and a cookie would add unnecessary request state. Browser-language inference was also rejected because the requested behavior is to remember an explicit choice and the static URL remains the default when no choice exists.

### Navigate through the page's declared locale links

On initialization, the module will compare the valid stored preference with `document.documentElement.lang`. When they differ, it will resolve the matching page-local language link and call `location.replace` with that link's URL. Query and fragment values from the current URL will be copied to the target so campaign and in-page context survive.

Using declared links avoids hard-coding GitHub Pages base paths or reconstructing route layouts in JavaScript. `replace` avoids leaving an automatic redirect in history that would send the visitor back into the same mismatch. The comparison links will gain the same `data-language-option` contract already used by the homepage.

### Share behavior from both existing entry points

The homepage and comparison scripts will both import and initialize the module before their page-specific interaction setup. Keeping this in existing bundles avoids an additional blocking script and preserves the static no-JavaScript fallback.

## Risks / Trade-offs

- [A JavaScript redirect can occur after the static page first paints] → Keep the module dependency-free and initialize it before page-specific behavior so navigation begins as early as the existing entry point permits.
- [Storage access can throw in restricted browsing contexts] → Catch reads and writes independently and leave the current static page unchanged.
- [Markup and script locale lists can drift] → Use one shared `data-language-option` contract and add build-time website tests for both routes, supported values, and navigation semantics.

## Migration Plan

Ship the shared module and updated link annotations with the next static website deployment. Existing visitors have no stored key and continue to receive the URL they requested until they explicitly choose a language. Rollback consists of removing the module imports and annotations; any leftover local value is inert without the client logic.
