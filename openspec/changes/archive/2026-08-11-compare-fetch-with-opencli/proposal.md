## Why

The existing comparison page explains browser-automation connection choices but does not help visitors distinguish Panerelay Fetch from OpenCLI site commands. A sourced implementation comparison and a reproducible benchmark can explain where Panerelay's tab-independent Fetch path improves authenticated request latency and concurrency without overstating the result for OpenCLI's direct public-HTTP commands.

## What Changes

- Extend both localized comparison pages with a neutral Panerelay Fetch versus OpenCLI section covering product scope, request path, browser-state handling, tab dependency, debugging UI, concurrency, and best-fit use cases.
- Add a reproducible benchmark for equivalent browser-authenticated request work, publish its environment and methodology, and present measured distribution data instead of an unsupported headline claim.
- Add a clearly separated Bilibili `me` field snapshot to show why real adapter gaps vary when page preparation and repeated browser round trips are included, without presenting that third-party observation as a universal benchmark.
- Link the comparison to primary implementation evidence, OpenCLI attribution, and the checked-in benchmark report.
- Add static-content, localization, responsive-layout, evidence-link, and claim-integrity tests.
- Keep OpenCLI public/direct HTTP commands explicitly outside the page-driven benchmark comparison.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `project-website`: Extend the bilingual comparison and search-discovery requirements with an evidence-backed Panerelay Fetch versus OpenCLI comparison and reproducible performance data.

## Impact

- Website source and styles under `apps/website`, including the English and Simplified Chinese comparison pages.
- Website source tests and static build output.
- A bounded benchmark fixture/report under `docs/spikes` or an equivalent checked-in reproducibility surface, including aggregate-only field evidence that retains no account data.
- No protocol, Extension permission, Bridge routing, site-adapter behavior, or automation-engine behavior changes.
- agent-browser 0.33.0, Browser Use 0.13.7 with Browser Harness 0.1.8, and Playwright CLI 0.1.17 remain the pinned automation evidence baselines. The comparison does not change browser ownership limits or claim support for isolated contexts, launch arguments, proxies, or whole-browser control.
