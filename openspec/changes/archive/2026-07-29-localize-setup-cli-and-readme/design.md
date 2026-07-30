## Context

The setup CLI currently embeds English text directly in `cli.ts`, while doctor reports carry stable IDs plus English labels, details, and hints. The JSON report is consumed by release smoke tests and may be consumed by Agents, so changing it to locale-dependent text would make automation unreliable.

## Goals / Non-Goals

**Goals:**

- Make the default interactive language match Chinese or English device locales.
- Provide deterministic per-invocation and environment overrides.
- Keep translation lookup small, typed, dependency-free, and testable.
- Preserve the existing doctor JSON contract.

**Non-Goals:**

- Do not introduce an ICU message runtime, locale files downloaded at runtime, or language persistence.
- Do not infer language from browser settings; the setup CLI is a local Node.js process.
- Do not translate file paths, command examples, executable names, or opaque external errors.

## Decisions

### Resolve one locale at CLI startup

Locale precedence is `--lang`, `PANERELAY_LANG`, the operating-system preferred language, locale environment variables, then English. On macOS the CLI reads the first `AppleLanguages` preference because Node's locale can reflect the terminal environment instead of the device language. Other platforms use Node's resolved system locale. English locale variants normalize to `en`; Chinese variants normalize to `zh-CN`; unsupported device locales fall back to English. An unsupported explicit `--lang` value is a usage error rather than a silent fallback.

### Keep translations inside the setup package

A typed dependency-free message catalog covers CLI-owned text. This keeps the first bilingual surface small and ensures the catalog is included automatically in the setup package's compiled `dist` output.

### Localize doctor presentation, not doctor data

`doctorPanerelay` continues returning stable IDs and its current JSON values. The human formatter maps known check IDs, status markers, details, and hints to the selected language. Unknown details remain unchanged, preserving useful operating-system and path information.

## Risks / Trade-offs

- **A new CLI string is left untranslated** → Keep CLI-owned strings in the catalog and cover both locale paths in tests.
- **System locale detection differs by shell** → Read macOS's preferred UI language before Node's locale, retain standard locale environment fallbacks, and provide two explicit override mechanisms.
- **Automation parses human output** → Document and preserve `doctor --json` as the only stable machine-readable contract.
- **Chinese variants differ** → Treat all Chinese locale variants as Simplified Chinese until additional translations are intentionally added.

## Migration Plan

1. Add locale normalization, resolution, and bilingual message lookup.
2. Route setup CLI presentation through the selected locale.
3. Add the Chinese README and document overrides.
4. Validate both languages, package contents, and unchanged doctor JSON behavior.
