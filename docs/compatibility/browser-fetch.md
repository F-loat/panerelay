# Browser-backed fetch compatibility

- Panerelay release: current development candidate
- Chrome baseline: shared Chromium Manifest V3 Extension
- Microsoft Edge baseline: shared Chromium Manifest V3 Extension
- Bilibili adapter: built-in `bilibili@0.8.0`
- Last updated: 2026-08-07

## Classification

| Surface | Chrome | Microsoft Edge | Notes |
| --- | --- | --- | --- |
| Raw `panerelay fetch` | Partial | Partial | Daily Chrome confirms the existing request transport matrix, generation-bound disconnect/recovery, wildcard Agent approval/retry, and explicit-denial revocation guidance. Automated coverage verifies exact/wildcard/all-domains policy, Agent approval correlation, side-panel management, revocation, and retry guidance. |
| Built-in `bilibili me` | Verified | Forwarded | Daily Chrome confirms installation, manifest-only help, logged-in nav, WBI signing, profile validation, OpenCLI-style table output, explicit `--json`, and the exact six-field result. Bilibili still exposes a private, unsupported API contract that can change independently. |
| Bilibili 19-command inventory | Partial | Automated | Manifest/registry agreement and command-focused fixtures cover all 16 reads plus guarded `comment`, verified `follow`, and verified `unfollow`. Daily Chrome additionally confirms one representative read and all three writes with cleanup; the other reads have not each been live-verified. `login` and `download` are explicitly excluded. |
| Local adapter format | Automated | Automated | Source validation, atomic batch install, protected registry, digest checks, bounded child execution, list, and removal are deterministic filesystem behavior. |
| Site-kit source and public GitHub installation | Automated | Automated | Static source discovery, deterministic two-file builds, commit-pinned public GitHub retrieval, bounded archive extraction, provenance, and atomic mixed batches are setup/tooling behavior. They grant no browser permission and do not change browser execution classification. |

`Partial` is intentionally conservative. Daily Chrome covers custom and removed `Origin`/`Referer`, real profile-cookie injection, no-cookie requests, JSON/text/Base64 framing, redirects, non-2xx responses, timeout failure, Host-generation replacement, wildcard Agent approval with root/subdomain retry, and explicit-denial revocation. The settings-only all-domains action and expanded side-panel management/revocation remain automated-only. `Forwarded` means behavior is expected to use the same Chromium implementation in Edge, but dedicated Edge evidence remains pending.

The 2026-08-07 daily-Chrome run used the matching development Extension and Host. Echo requests returned explicit `Origin` and `Referer` unchanged and omitted both after explicit empty values. A Bilibili `HEAD` request returned HTTP 200 and reported 26 attached cookies without exposing cookie data. Separate requests confirmed no-cookie behavior, HTTP 404 as a transport success, a followed redirect ending at HTTP 204, text and Base64 bodies, and a bounded 100 ms timeout failure. An in-flight loopback request failed immediately when its exact Native Host process ended, did not retry through another browser, and a request after automatic re-registration succeeded. Setup installed `bilibili@0.8.0`, both fetch help levels rendered from manifests, and `panerelay fetch bilibili me` returned exactly `name`, `uid`, `level`, `coins`, `followers`, and `following` in both the default table and explicit `--json` modes. The same daily profile later confirmed direct `panerelay bilibili` help, table and JSON execution, identical JSON fields through the explicit form, and the unchanged unknown-command failure for an uninstalled site without retaining account values. After reconnecting to the matching Cookie-binding Host, a non-followed account was followed and immediately unfollowed with both states verified, and one temporary comment was created and deleted through CSRF-bound form requests. The original relation state was restored. No target identifiers, comment identifiers or text, response bodies, cookie data, WBI material, signatures, or account values are retained in this record.

A later 2026-08-07 readiness probe initially found one live Chrome registration whose Extension and Host both reported 0.8.0 with browser fetch enabled, but the new registration-authenticated fetch-permission endpoint returned HTTP 404. Reloading the Extension produced the same result, isolating the mismatch to the immutable same-version Host/Bridge installation. After a clean local Host reinstall and Extension reload from the matching build, an Agent request for `*.baidu.com` opened the confirmation window and returned a granted domain-scope result after the user approved it. Separate no-cookie `HEAD` requests to the root and `www` host both returned HTTP 200; the root request followed its normal redirect to `www`. After the final two-action popup build was loaded, the user denied a repeated wildcard request and the CLI returned the exact retry command. A subsequent no-cookie `HEAD` request to `www` failed before network work with domain-authorization guidance, confirming that explicit denial removed the identical wildcard grant. This verifies wildcard approval, persistence, root/subdomain matching, explicit-denial revocation, and retry guidance without retaining browser identifiers, cookies, response headers, or bodies. The settings-only all-domains action and expanded side-panel management/revocation remain deterministic automated evidence.

## Stable boundaries

- Fetch uses one RFC-0006 browser selection and stays pinned to its browser ID and Host generation.
- Fetch creates no CDP participant, tab attachment, page navigation, focus change, or control lease.
- Before cookie, request-header-rule, or network work, the Extension requires an exact hostname, leading-wildcard, or all-domains Panerelay grant. Domain matching ignores scheme and port; `*.example.com` includes the root and subdomains.
- Unauthorized fetch fails with `panerelay fetch --authorize <domain>` guidance. Only that explicit registration-authenticated command or a direct settings action can open/request Chrome Host Permission; adapter fetch-session credentials cannot widen access.
- Fetch grants are visible and immediately revocable in the Extension. Panerelay-only revocation does not remove Chrome Host Permission that browser automation or another capability may still use.
- Browser Cookie inventory and Cookie values are collected and injected only inside the Extension. An adapter may send a bounded exact Cookie name as a binding selector, but neither the selected value nor other Cookie metadata crosses Native Messaging, enters adapter input, or appears in normal CLI output.
- Cookie bindings support required/optional form, top-level JSON, and header destinations. Bound requests reject redirects, and the Extension sanitizes the resolved value from returned headers, bodies, and errors.
- `Origin` and `Referer` default to the target origin and `<origin>/panerelay`; explicit values win and explicit empty values remove the generated header.
- Help reads installed manifest metadata without browser selection or adapter execution. A local adapter remains user-trusted code rather than an OS sandbox.

## Unchanged automation classifications

This feature does not change the protocol or ownership behavior of agent-browser 0.33.0, Browser Use 0.13.7, or Playwright CLI 0.1.17. Their existing compatibility records remain authoritative. Fetch-only sessions use separate endpoints, credentials, limits, and pending-request state; they never enter automation participant or control-lane accounting.

Source-form and GitHub installation are deliberately classified separately from browser-backed execution. Setup may statically inspect and build an adapter without a browser; it does not preflight Chrome Host Permission, authorize a tab, select a browser, create an automation participant, or acquire a control lease. The installed two-file child continues through the same fetch-session and Extension-enforced domain-policy boundary as built-ins and existing local adapters.

Direct `panerelay <site> <command>` invocation is an additive CLI routing alias for an exact installed adapter ID. It reuses the explicit `panerelay fetch <site> <command>` path and does not change any Chrome, Edge, permission, browser-selection, adapter-process, or automation-engine classification. Built-in CLI commands retain precedence, and raw URLs continue to require the `fetch` namespace.

## Required live follow-up

Before upgrading the classifications, use a candidate Extension and matching Host/CLI in an existing browser profile to verify:

1. unauthorized denial and retry guidance, followed by exact-domain approval and a successful retry;
2. `*.example.com` root/subdomain behavior, all-domains approval, expanded grant management, and immediate Panerelay-only revocation;
3. popup denial, close, and Chrome Host Permission rejection with the matching Extension and Host/CLI;
4. the remaining Bilibili read-command matrix beyond the live `me` coverage;
5. the corresponding raw-fetch, permission, and Bilibili adapter matrix in Microsoft Edge.

Store any request/response bodies, cookies, browser logs, or machine-specific output outside the repository. Record only bounded, non-sensitive conclusions here.
