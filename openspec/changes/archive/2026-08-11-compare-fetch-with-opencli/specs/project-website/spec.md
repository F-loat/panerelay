## ADDED Requirements

### Requirement: Evidence-backed Panerelay Fetch and OpenCLI comparison

The English and Simplified Chinese comparison pages SHALL include a dedicated Panerelay Fetch versus OpenCLI section. It SHALL distinguish Panerelay's Extension-background, tab-independent authenticated Fetch path from OpenCLI's broader adapter platform and its `PUBLIC`, `COOKIE`, `INTERCEPT`, and `UI` execution strategies; compare request path, browser-state handling, target-tab dependency, debugging UI, concurrency behavior, and best-fit scope; credit and link OpenCLI; and avoid presenting either product as a universal replacement for the other.

#### Scenario: Visitor compares implementation paths

- **GIVEN** a visitor is choosing how an Agent should call a known authenticated endpoint
- **WHEN** the visitor reads either localized comparison page
- **THEN** the page explains that Panerelay Fetch executes through the Extension without attaching or navigating a target tab and that OpenCLI behavior depends on the selected adapter strategy
- **AND** it states that OpenCLI remains broader in site coverage, page and desktop automation, and local-tool routing

#### Scenario: Visitor identifies the relevant efficiency boundary

- **GIVEN** the page discusses speed, concurrency, or debugging UI
- **WHEN** it compares Panerelay with OpenCLI
- **THEN** it scopes those differences to equivalent browser-authenticated request work that OpenCLI performs through a browser-backed or page-driven path
- **AND** it explicitly excludes OpenCLI `PUBLIC` direct-HTTP commands from any claim that Panerelay is inherently faster

### Requirement: Reproducible performance evidence

Every numeric execution-efficiency claim on the comparison pages SHALL be documented in a checked-in report. The controlled benchmark SHALL report the benchmark date, machine and operating system, browser and runtime versions, compared source versions or commits, fixture and authentication model, warm-up and measured sample counts, concurrency level, metric definition, and median and tail-latency results. It SHALL compare equivalent successful requests, SHALL avoid real user credentials and third-party rate limits, and SHALL identify local-loopback or synthetic conditions as such. A supplemental real-site adapter snapshot MAY use an existing authenticated browser session when it retains only aggregate timing and success data, identifies the exact commands and timing boundary, reports warm-up and alternating sample counts plus median and p95 results, explains material adapter-path differences, and is labeled as variable third-party evidence rather than a controlled or universal benchmark. The page SHALL link the methodology and SHALL not generalize either result to arbitrary sites, networks, or OpenCLI strategies outside the measured path.

#### Scenario: Visitor evaluates a performance number

- **GIVEN** a numeric latency, throughput, or speedup value appears on either localized page
- **WHEN** the visitor follows its evidence link
- **THEN** the checked-in report provides enough environment, command, sample, and metric detail to reproduce the measurement
- **AND** the page states the measured scope and does not imply a universal production result

#### Scenario: Benchmark protects browser data

- **GIVEN** the benchmark is run by a maintainer
- **WHEN** it exercises authenticated request behavior
- **THEN** it uses a synthetic local authentication token or equivalent fixture rather than reading, printing, or retaining browser cookies, credentials, page content, or third-party response bodies

#### Scenario: Visitor interprets a real adapter snapshot

- **GIVEN** a numeric real-site adapter result supplements the controlled benchmark
- **WHEN** the visitor reads the result or follows its evidence link
- **THEN** the page and report distinguish live site, login state, network variation, page preparation, and adapter implementation from the isolated request-path benchmark
- **AND** they state that no account response, credential, cookie, or identity was retained

### Requirement: Fetch comparison remains bilingual and responsive

The new comparison content SHALL be statically rendered in English and Simplified Chinese, remain understandable without JavaScript, preserve semantic heading and table structure, and remain readable without document-level horizontal scrolling at 375 CSS pixels.

#### Scenario: Narrow localized comparison remains usable

- **GIVEN** a visitor opens either localized comparison page at 375 CSS pixels
- **WHEN** the Fetch and OpenCLI section is rendered
- **THEN** its explanation, measurements, limitations, and evidence links remain readable and keyboard operable without information available only through hover or script execution
