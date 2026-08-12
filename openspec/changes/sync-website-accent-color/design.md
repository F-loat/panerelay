## Context

See `proposal.md` for motivation and `specs/website-appearance-sync/spec.md` for observable behavior. The Extension already validates and stores a local accent color, while the static GitHub Pages website owns a dark palette through root CSS custom properties. The website cannot read Extension storage directly, and RFC-0001 requires presentation concerns to remain separate from site permission, tab authorization, debugger attachment, Agent sessions, and control ownership.

## Goals / Non-Goals

**Goals:**

- Give every deployed website route a small optional client for the official Extension's accent palette.
- Keep the channel read-only, versioned, origin-checked, and resilient to Manifest V3 service-worker suspension.
- Reuse the website's existing CSS-variable vocabulary and preserve its static no-Extension rendering.

**Non-Goals:**

- Keep the Extension service worker alive indefinitely or route presentation through the Bridge.
- Support custom/self-built Extension IDs, local preview origins, other GitHub Pages projects, or arbitrary websites.
- Synchronize locale, dark/light mode, page content, permissions, browser targets, conversations, or credentials.

## Decisions

### Use an externally connectable port scoped to the deployed website route

The manifest declares only `https://f-loat.github.io/panerelay/*` as a web-page match. The website opens a named `runtime.connect` port to the retained official Extension ID. The background worker independently validates the port name plus the sender URL's HTTPS origin and `/panerelay/` path before responding. It sends the current palette immediately, retains accepted ports only in worker memory, and publishes a new snapshot on accent-storage changes.

This channel is a Verified Chrome Extension/web-page messaging capability in automated coverage. Production end-to-end verification requires the matching Extension and website artifacts to be deployed together, so the daily Chrome check remains a post-release acceptance gate rather than a pre-release claim. Edge behavior remains Forwarded under RFC-0005 until separately verified. It does not affect the agent-browser 0.33.0 compatibility groups.

Alternative considered: inject a content script into the website. Rejected because script injection couples cosmetic synchronization to Chrome Host Permission and Panerelay's site-authorization surfaces. Alternative considered: pass appearance in query parameters. Rejected because it does not update already-open pages and leaks a local preference into URLs and navigation records.

### Publish a purpose-specific validated palette

The Extension derives a three-color website palette from the normalized local accent: a contrast-safe primary accent plus deterministic light and dark companions. Messages carry a literal protocol/version discriminator and six-digit hexadecimal colors only. The website validates the complete shape again before setting `--green`, `--green-soft`, and `--green-dark` on the document root.

Alternative considered: send the entire Extension appearance object or raw storage value. Rejected because those formats expose unrelated presentation internals and make the website responsible for Extension storage validation. Alternative considered: move website appearance into the shared Agent/browser protocol. Rejected because this channel never crosses the Bridge or an Agent boundary.

### Reconnect without using a keepalive heartbeat

Manifest V3 may suspend the background worker and disconnect an in-memory port. The website installs one disconnect handler and retries after a fixed bounded delay while the page remains loaded. Every accepted connection begins with a fresh snapshot, so no event replay or persistent subscriber registry is required. The website closes the current port and cancels retry state during page teardown.

Alternative considered: periodic heartbeat messages that keep the Extension worker active. Rejected because cosmetic synchronization does not justify continuous background activity.

### Preserve website defaults as the failure state

The website's checked-in root variables remain authoritative until a complete valid palette arrives. Unsupported APIs, missing Extensions, connection failures, malformed messages, and disconnects are silent presentation fallbacks; they do not add error UI or alter existing interaction initialization.

## Risks / Trade-offs

- [The public page can detect that the official Extension is installed] → Limit connectability to the exact owned deployment route and expose only a presentation palette the user chose to display.
- [GitHub Pages origin hosts other repository sites] → Validate the `/panerelay/` path in both the manifest pattern and background worker rather than trusting the shared origin alone.
- [Service-worker suspension creates a short synchronization gap] → Reconnect after a bounded delay and always send the current snapshot first.
- [An unusual user accent produces weak website combinations] → Derive all three colors from the Extension's contrast-normalized dark-surface accent and cover the output format and contrast in tests.
- [A custom Extension build has a different ID] → Treat it as Unsupported for this convenience channel; the website keeps its default palette.

## Migration Plan

Ship the Extension manifest/handler and website client together in the lockstep release. Existing installations gain the manifest allowlist on update; existing website visitors retain the default palette until both sides are available. After both artifacts are deployed, verify initial synchronization, live updates, fallback behavior, and unchanged authorization/control state in the daily Chrome profile before promoting the compatibility evidence beyond Partial. Rollback removes the website client and external manifest declaration/handler; no stored data or protocol migration is required.
