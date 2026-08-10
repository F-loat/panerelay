# Spike 0008: Browser fetch v3 authority

- Date: 2026-08-10
- Status: Verified with matching reloaded daily Chrome
- Governing RFC: [RFC-0010](../rfcs/0010-browser-state-fetch-authority-and-agent-routing.md)

## Question

Can the matching Manifest V3 Extension and daily Chrome profile enforce redirect rejection, explicit outgoing no-cookie behavior, normal unpartitioned Cookie write-back, and exact-origin protected `localStorage` injection without disclosing browser state?

## Fixture

`fixtures/browser-fetch-v3/server.mjs` serves one fixed loopback origin:

- `/redirect` returns a same-origin 302;
- `/set-cookie`, `/cookie`, and `/clear-cookie` exercise browser Cookie persistence and outgoing inclusion/removal;
- `/` seeds a synthetic `localStorage` JSON value in a real page;
- `/storage/status` verifies the protected Authorization destination and deliberately reflects it so Extension redaction can be checked.

`fixtures/browser-fetch-v3/site-adapter` is a source-form adapter with one exact origin and one fixed localStorage binding. It cannot choose a storage key or destination at invocation time.

## Procedure

1. Build and install the matching development Host and Extension, then reload the unpacked Extension.
2. Start `node docs/spikes/fixtures/browser-fetch-v3/server.mjs`.
3. Open `http://127.0.0.1:43919/` in that browser, click **Seed localStorage fixture**, and confirm the page says `Seeded`.
4. Explicitly approve `127.0.0.1` in the Panerelay fetch permission window if requested.
5. Install the fixture with `node packages/setup/dist/cli.js add docs/spikes/fixtures/browser-fetch-v3/site-adapter`.
6. Run raw fetches against `/redirect`, `/set-cookie`, and `/cookie` with and without Cookies, then run `node packages/cli/dist/cli.js browser-fetch-v3-fixture storage --json`.
7. Clear the synthetic Cookie, remove the fixture adapter, and stop the server.

Do not retain response bodies, Cookie values, storage values, browser logs, or browser identifiers. Record only the booleans and failure classifications below.

## Expected conclusions

- Redirect: explicit transport failure before `/final` is requested.
- Cookie write-back: `/set-cookie` causes a later Cookie-enabled `/cookie` request to report `present: true`.
- No-cookie removal: the same endpoint reports `present: false` with `--no-cookies` even after write-back.
- Exact-origin localStorage: the adapter reports `authorized: true` and `redacted: true` only while an exact-origin tab is already open.
- Lifecycle: closing the matching tab makes the storage-bound call fail before network work; the Extension does not navigate or open another tab.

## Evidence

The matching development Host and reloaded daily Chrome Extension completed the fixture on 2026-08-10:

- `/redirect` failed as a redirect transport error and did not complete at the target;
- a request after `/set-cookie` reported the synthetic Cookie present, while the same endpoint with explicit no-cookie behavior reported it absent;
- the installed fixture adapter reported `authorized: true` and `redacted: true` for its fixed exact-origin `localStorage` binding;
- after the exact-origin tab closed, the storage-bound call failed and the fixture's bounded request counter remained unchanged, confirming failure before network work;
- a real stdio MCP `browser_fetch` call through the stable launcher, Browser Registry, Bridge, and Extension returned a successful HTTP response.

The synthetic Cookie was cleared, the fixture adapter was removed, and the fixture server and tab were closed. No response body, Cookie value, storage value, browser log, browser identifier, or machine-specific configuration path is retained.
