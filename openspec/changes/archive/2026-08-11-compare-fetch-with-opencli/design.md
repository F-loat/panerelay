## Context

The static comparison route currently covers four browser-automation connection approaches and has bilingual HTML, responsive CSS, source tests, and locale routing. Panerelay's Fetch path and OpenCLI's adapter strategies are absent. See `proposal.md` for motivation and `specs/project-website/spec.md` for the public evidence contract.

The comparison must not collapse OpenCLI into one execution model. `PUBLIC` and `LOCAL` commands avoid browser automation, while `COOKIE`, `INTERCEPT`, and `UI` commands may allocate or reuse a browser page and execute work in that context. Panerelay migrates only commands that fit its bounded Extension-background Fetch contract.

## Goals / Non-Goals

**Goals:**

- Explain the implementation and operational differences in a compact bilingual section on the existing comparison route.
- Measure a narrow end-to-end browser-authenticated request workload with real released/local executables and a real existing Chrome connection.
- Supplement the controlled fixture with one aggregate-only real adapter snapshot that explains why command-level gaps vary.
- Keep benchmark inputs synthetic, fixed, local, credential-free, and reproducible.
- Make the performance scope and limitations as visible as the headline values.

**Non-Goals:**

- Rank all OpenCLI commands or claim Panerelay is faster than OpenCLI `PUBLIC` direct-HTTP adapters.
- Benchmark DOM extraction, navigation, WAF handling, third-party network latency, or site-specific parsing.
- Change either project's runtime, browser extension, permissions, protocol, or adapter behavior.
- Change the pinned agent-browser 0.33.0, Browser Use 0.13.7/Browser Harness 0.1.8, or Playwright CLI 0.1.17 evidence baselines or Panerelay's browser-process ownership limits.

## Decisions

### Add a distinct Fetch comparison after the connection matrix

The page will keep the existing automation comparison intact and add a new section before the Panerelay authorization model. It will contain an implementation-path explanation, a semantic comparison table, measured result cards, and a plainly visible scope note. Existing later section numbers and navigation labels will move accordingly.

Alternative: add OpenCLI as a fifth row in the automation matrix. Rejected because OpenCLI is a broader command platform and Panerelay Fetch is not a browser-automation connection approach; mixing them would compare different abstraction levels.

### Benchmark a page-driven authenticated request baseline, not all OpenCLI

A checked-in Node fixture will serve a fixed JSON payload on loopback and require a synthetic same-origin HttpOnly cookie. A prepared existing Chrome session will execute the same successful GET through:

- `panerelay fetch`, which routes through the Bridge and Extension-background Fetch without a target tab; and
- an OpenCLI browser session whose page executes `fetch()` through its existing page/CDP command path.

The benchmark will measure whole child-process wall time after both browser connections are warm. It will include sequential samples and bounded concurrent rounds, count failures, and publish median and p95 latency plus completion time for each concurrent batch. The page-driven comparator deliberately keeps one prepared OpenCLI page session, making the comparison conservative with respect to repeated navigation and tab creation.

Alternative: use a public production site adapter such as Hacker News or Bilibili as the primary benchmark. Rejected because direct public HTTP is not the relevant architectural difference, while third-party latency, login expiry, WAFs, and rate limits would make the data hard to reproduce and easy to misread.

Alternative: benchmark private runtime functions in-process. Rejected because it would omit executable startup, Bridge/daemon transport, and serialization costs visible to an Agent invoking the CLI.

### Keep the Bilibili result as a separate field snapshot

The page and report will supplement, not replace, the controlled loopback result with `bilibili me`. One warm-up invocation per implementation is discarded, then ten complete CLI processes are measured in alternating order against the same browser profile and account session. Only aggregate duration and success data are retained.

The explanation will identify why this command can show a larger gap: OpenCLI's ephemeral `COOKIE` path pre-navigates and settles a page, and its implementation evaluates three page-context API requests, including two navigation-data requests. Panerelay performs two Extension-background requests because its Bilibili client caches navigation data. This is an implementation-inclusive command comparison, not an isolated Fetch transport comparison.

Alternative: present the field result as another card in the controlled benchmark. Rejected because that would obscure the different authentication, network, request-count, and reproducibility conditions.

### Publish aggregate evidence and the runnable fixture

The repository will retain the fixture source and a Markdown spike report with the command, environment, source identities, methodology, aggregate results, and limitations. It will not retain browser logs, cookies, response bodies, screenshots, machine-specific paths, or per-run credentials. The website will link to the report and primary OpenCLI/Panerelay implementation sources.

### Treat performance numbers as dated evidence

Website tests will assert the benchmark identity, sample sizes, result values, evidence link, OpenCLI credit, and exclusion of `PUBLIC` commands. Updating a number therefore requires updating both the checked-in report and the page. The copy will use “measured in this local benchmark” rather than an unqualified product-wide speed claim.

## Risks / Trade-offs

- [Local loopback understates real network time, making fixed software overhead look proportionally larger] → Label the workload as an overhead benchmark and avoid extrapolating its ratio to production sites.
- [OpenCLI page commands are not every OpenCLI site adapter] → Name the comparator “OpenCLI page-driven browser path,” explain strategy differences, and exclude `PUBLIC` direct HTTP from the claim.
- [CLI startup can dominate small requests] → Report whole-command wall time because that is Agent-visible, disclose the metric, and keep the payload and server delay fixed.
- [Concurrent commands may fail because a product intentionally serializes shared state] → Report success counts beside latency and use a bounded concurrency level rather than discarding failed samples.
- [A future release invalidates the numbers] → Include date, versions/commits, browser/runtime, and hardware, and describe the result as a snapshot rather than a permanent guarantee.
- [A logged-in third-party example can expose account data or imply production-wide performance] → Discard response output, retain aggregate timing only, disclose the live-site variables, and keep it visually and textually separate from the controlled fixture.

## Migration Plan

1. Add and run the benchmark fixture against the current local Panerelay and OpenCLI sources.
2. Check in the methodology and aggregate report without sensitive or machine-specific output.
3. Add matching English and Simplified Chinese comparison content and source links.
4. Add a separately labeled aggregate Bilibili field snapshot after alternating successful invocations.
5. Verify static tests, build output, desktop and 375-pixel layouts, and no-JavaScript readability.
6. Roll back by removing the new section, report, fixture, and delta spec; no runtime or user data migration is involved.
