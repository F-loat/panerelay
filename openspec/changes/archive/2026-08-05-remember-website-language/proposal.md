## Why

Visitors who explicitly switch the public website between English and Simplified Chinese currently lose that choice on a later visit. Remembering the explicit choice locally lets the static site reopen the equivalent localized page without requiring an account or backend state.

## What Changes

- Store a supported locale in browser-local storage when a visitor activates a website language link.
- On later JavaScript-enabled page loads, navigate to the equivalent localized homepage or comparison page when the stored locale differs from the served document language.
- Preserve the current query string and fragment during automatic locale navigation, while ignoring missing, inaccessible, or invalid stored values.
- Keep statically rendered English and Simplified Chinese documents, ordinary language links, and complete no-JavaScript content as fallbacks.
- Non-goals: inferring a first-visit locale from browser settings, synchronizing preferences across devices, adding cookies or server-side locale routing, or changing any browser attachment, control, ownership, permission, or agent-browser compatibility behavior.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `project-website`: Require the bilingual homepage and comparison pages to remember an explicit locale choice locally and restore the corresponding static page on later visits.

## Impact

- Affects the website language-link markup, shared client-side locale preference logic, and website build/tests under `apps/website`.
- Adds no runtime dependency, network service, cookie, credential, or backend API.
- Browser-process ownership and Panerelay's authorization/control boundaries are unchanged. The pinned agent-browser 0.33.0 baseline and every documented compatibility group are unaffected.
