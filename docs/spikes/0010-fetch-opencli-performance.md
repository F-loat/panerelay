# Spike 0010: Panerelay Fetch and OpenCLI page-fetch performance

- Date: 2026-08-11
- Status: Verified locally
- OpenSpec change: `compare-fetch-with-opencli`
- Governing RFC: [RFC-0009](../rfcs/0009-browser-backed-fetch-and-site-adapters.md)
- Fixture: [`run-fetch-opencli-benchmark.mjs`](./run-fetch-opencli-benchmark.mjs)

## Question

For an authenticated HTTP request that needs the current browser session, how does a complete Panerelay Fetch CLI invocation compare with an OpenCLI invocation that evaluates `fetch()` in an already prepared browser page?

This is deliberately narrower than a product-wide Panerelay/OpenCLI comparison. OpenCLI also has `PUBLIC` and `LOCAL` strategies that avoid a browser, plus page interaction, interception, and desktop workflows. Those paths are outside this benchmark.

## Implementations under test

Panerelay `fetch` selects a connected browser, creates a short-lived Fetch session through the Bridge, and asks the Extension background worker to issue the request with browser credentials. The request does not attach to, navigate, focus, or control a tab. The relevant implementation is the [Extension background fetch](https://github.com/F-loat/panerelay/blob/85ed5e379ab4adf21d3d0016c0d8325c6e1a6b76/apps/extension/src/background/browser-fetch.ts#L451-L470), with the CLI entry at [`runFetchCommand`](https://github.com/F-loat/panerelay/blob/85ed5e379ab4adf21d3d0016c0d8325c6e1a6b76/packages/cli/src/fetch-command.ts#L689-L730).

OpenCLI browser-backed commands hold a page session and send JavaScript to the extension/daemon `exec` path. This benchmark prepared one page once and invoked that path with an async page-context `fetch()`. The relevant implementation is OpenCLI's [`evaluate`](https://github.com/jackwener/OpenCLI/blob/399c0de2a76eb979aee3a3836cf2d24fd247780f/src/browser/page.ts#L173-L184). OpenCLI's own command normalization keeps `PUBLIC` and `LOCAL` strategies out of the browser path, while authenticated `COOKIE` commands normally use it; see [`normalizeCommand`](https://github.com/jackwener/OpenCLI/blob/399c0de2a76eb979aee3a3836cf2d24fd247780f/src/registry.ts#L184-L205).

## Method

The checked-in fixture starts an HTTP server on a random `127.0.0.1` port. Its setup page writes a synthetic HttpOnly cookie. Its API endpoint requires that cookie and returns JSON with a fixed 1 KiB payload field. No external account, production endpoint, credential, rate limit, or internet latency is involved.

Both cases measure a complete CLI process from spawn to successful parsed output:

- Panerelay: `node packages/cli/dist/cli.js fetch <url> --response json`
- OpenCLI: `opencli browser <prepared-session> eval <page-fetch-expression>`

The OpenCLI page is opened only once before measurement. Repeated tab creation and navigation are intentionally excluded, so the result is conservative for OpenCLI's page-driven path. Five warm-up calls per implementation are discarded. Thirty sequential calls are run in alternating order, followed by ten alternating batches of eight concurrent CLI calls.

## Environment

- Apple M4 Pro, 12 logical CPUs, 48 GiB memory
- macOS 26.5.2 / Darwin 25.5.0
- Google Chrome 151.0.7922.108, normal daily profile with both extensions connected
- Node.js 20.19.5
- Panerelay CLI 0.9.0, commit `85ed5e379ab4adf21d3d0016c0d8325c6e1a6b76`
- OpenCLI 1.8.6, commit `399c0de2a76eb979aee3a3836cf2d24fd247780f`

## Results

All 30 sequential calls and all 80 concurrent calls per implementation succeeded and returned the authenticated payload.

| Complete CLI measurement | Panerelay Fetch | OpenCLI prepared-page fetch | Difference |
| --- | --: | --: | --: |
| Sequential median | 129.9 ms | 217.1 ms | Panerelay 40.2% lower latency (1.67×) |
| Sequential p95 | 150.7 ms | 240.4 ms | Panerelay 37.3% lower latency (1.60×) |
| Eight-request batch median | 227.7 ms | 441.4 ms | Panerelay 48.4% lower completion time (1.94×) |
| Eight-request batch p95 | 239.8 ms | 463.4 ms | Panerelay 48.3% lower completion time (1.93×) |
| Median concurrent throughput | 35.1 requests/s | 18.0 requests/s | Panerelay 1.95× as high |
| Successful requests | 110 / 110 | 110 / 110 | No failures |

## Interpretation

In this browser-authenticated request case, Panerelay's dedicated background Fetch path avoids routing each request through a target page and its JavaScript-evaluation command path. On this machine that reduced the median complete-command latency by about 40% and nearly halved the completion time of an eight-request batch.

These measurements support an implementation and execution-efficiency comparison, not a universal claim that Panerelay is faster than every OpenCLI command. In particular, OpenCLI `PUBLIC` commands may use direct non-browser HTTP and are not represented. OpenCLI also covers broader page and desktop operations that Panerelay Fetch does not attempt to replace.

## Field snapshot: Bilibili `me`

A real adapter command can show a larger difference because it includes site preparation and the adapter's own request graph, not only the request transport isolated above. As a supplemental observation, the two equivalent profile commands were run against the same logged-in Chrome profile and Bilibili account session:

- Panerelay: `node packages/cli/dist/cli.js bilibili me`
- OpenCLI: `opencli bilibili me`

One successful invocation per implementation was discarded as warm-up. Ten measured invocations per implementation then ran in alternating order, reversing the first implementation each round. Each duration covers the complete child process from spawn to successful exit; stdout was discarded and no profile response, account identity, cookie, credential, browser log, or page content was retained.

| Complete CLI measurement | Panerelay `bilibili me` | OpenCLI `bilibili me` | Difference |
| --- | --: | --: | --: |
| Median | 633.8 ms | 2753.0 ms | Panerelay 77.0% lower latency (4.34×) |
| p95 | 740.5 ms | 3070.2 ms | Panerelay 75.9% lower latency (4.15×) |
| Range | 566.8–740.5 ms | 2356.7–3070.2 ms | — |
| Successful invocations | 10 / 10 | 10 / 10 | No failures |

The source explains why this field result is wider than the controlled fixture. OpenCLI registers `bilibili me` as an ephemeral `COOKIE` command, so execution [pre-navigates the Bilibili page](https://github.com/jackwener/OpenCLI/blob/399c0de2a76eb979aee3a3836cf2d24fd247780f/src/execution.ts#L306-L320) and [waits for page stability](https://github.com/jackwener/OpenCLI/blob/399c0de2a76eb979aee3a3836cf2d24fd247780f/src/browser/page.ts#L91-L126). Its command then obtains the UID, obtains WBI keys, and requests the profile through three page-context evaluations; the first two both [request navigation data](https://github.com/jackwener/OpenCLI/blob/399c0de2a76eb979aee3a3836cf2d24fd247780f/clis/bilibili/utils.js#L126-L175). Panerelay does not prepare a target page and its Bilibili client [caches navigation data](https://github.com/F-loat/panerelay/blob/85ed5e379ab4adf21d3d0016c0d8325c6e1a6b76/packages/sites/src/bilibili/client.ts#L237-L247), so `bilibili me` performs two Extension-background API requests: navigation data and the signed profile request.

This is an implementation-inclusive field snapshot, not a controlled transport benchmark. Bilibili response time, browser login state, page cache, site behavior, and both adapter implementations can change the absolute values and ratio. It demonstrates why commands that require navigation and several CDP/page round trips can have a larger gap; it does not predict other sites or OpenCLI strategies.

## Reproduce

Build Panerelay, connect the Panerelay and OpenCLI extensions to the same Chrome profile, grant Panerelay Fetch access to `127.0.0.1`, and run:

```bash
node docs/spikes/run-fetch-opencli-benchmark.mjs
```

Sample sizes can be changed with `--warmup`, `--sequential`, `--concurrency`, and `--batches`. The script prints aggregate JSON only and releases the temporary OpenCLI session before exiting.

Absolute timings depend on hardware, browser/runtime versions, extension state, and process startup cost. The loopback fixture isolates command-path overhead and does not predict end-to-end latency against a real remote service. This snapshot is documentation evidence, not a performance regression gate. No raw browser logs, cookies, response bodies, or generated runtime artifacts are retained.
