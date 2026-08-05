## Context

See `proposal.md` for the compatibility failure. RFC-0002 defines a reserved session label that the agent-browser Provider parses into one browser registration UUID and one target UUID. RFC-0007 reuses that label for target-scoped Playwright guidance and participant attribution. Both UUIDs must remain opaque, exact, and recoverable before browser selection; URL/title matching, authorization widening, and a stateful cross-process lookup are excluded by the accepted architecture.

The current `panerelay-tab-v1-<browser-uuid>-<target-uuid>` representation is 90 characters. Its archived design assumed an upstream 128-character limit, while agent-browser 0.33.0 enforces a 64-character session-name contract for browser work and also derives a bounded Unix socket path from the name.

## Goals / Non-Goals

**Goals:**

- Produce one deterministic session value accepted by agent-browser 0.33.0 on every supported platform.
- Recover both canonical UUIDs without storage, browser access, or ambiguity.
- Keep malformed current values and the unusable legacy target prefix fail-closed.
- Preserve ordinary non-reserved session names and every existing authorization and ownership boundary.

**Non-Goals:**

- Changing agent-browser, Playwright, browser selection, target ordering, authorization, control leases, or browser-process ownership.
- Adding a compatibility shim, patching an upstream executable, or relying on a machine-specific socket-directory override.
- Reorienting already resumed provider-native conversations retroactively.

## Decisions

### Encode the UUID bytes rather than their textual form

The current helper will decode each canonical UUID's 32 hexadecimal digits into 16 bytes, concatenate the browser bytes followed by the target bytes, and encode the 32-byte payload as unpadded base64url. The new reserved format is:

```text
panerelay-v2-<43-character-base64url-payload>
```

The fixed prefix plus payload is 56 characters. It uses only ASCII letters, digits, hyphen, and underscore, so it satisfies agent-browser 0.33.0's length and character constraints with margin for socket-path construction. Decoding reconstructs canonical lowercase UUID text, validates UUID version and variant bits through the existing validator, and re-encodes the value to require one canonical representation.

Encoding the 64 hexadecimal digits directly would remain too long. Hashing the pair would fit but require a stateful lookup and collision lifecycle. Compressing JSON would add variability and complexity. Two fixed 16-byte UUID values are already the minimal stable input and make base64url deterministic and portable.

### Reserve v2 without silently accepting v1

`panerelay-v2-` becomes the current conversation-target prefix. The Provider rejects values beginning with either that prefix or the old `panerelay-tab-v1-` prefix when the current parser cannot recover one canonical pair. It does not reserve every `panerelay-` name, so ordinary names such as `panerelay-task` keep the existing default-browser path.

The old v1 form is not accepted as an exact hint because agent-browser cannot use it for browser commands. Silently treating it as ordinary would violate fail-closed target orientation. Existing native transcripts may retain old guidance, but target hints are already staleable and resumed sessions are not retroactively reoriented.

### Keep one shared helper for agent-browser and Playwright

Bridge context rendering, the agent-browser Provider, and the target-scoped Playwright gateway continue using the protocol helper. This keeps session attribution and Agent guidance identical while leaving the Playwright target URL's existing independently validated selection token unchanged.

RFC-0002 will replace the durable v1 format decision and document the upstream 64-character constraint. RFC-0007 will reference the shared compact format. The agent-browser 0.33.0 and Playwright CLI 0.1.17 matrices remain `Automated` until their existing injected-context daily-browser acceptance gaps are run; this fix does not promote either claim to `Verified`.

## Risks / Trade-offs

- **[Base64url decoding accepts alternate padded or non-canonical spellings]** → Match exactly 43 unpadded characters and require decode/re-encode equality.
- **[Arbitrary 32-byte payloads decode to UUID-shaped text]** → Reuse canonical UUID version/variant validation for both reconstructed identifiers.
- **[A legacy prompt retries through ordinary target selection]** → Reject the old target prefix in the Provider rather than treating it as a user session.
- **[A compact opaque value is less manually readable]** → Keep the recognizable versioned prefix and treat the value as generated guidance that users and Agents must not construct manually.

## Migration Plan

1. Ship the encoder, parser, Provider rejection rule, and tests together in the lockstep release.
2. New Side Panel conversations immediately inject v2; existing ordinary sessions remain unchanged.
3. Update RFCs, package guidance, and compatibility records in the same change.
4. Rollback restores the previous code and documents that exact Side Panel target orientation is unavailable on agent-browser 0.33.0; no persisted authorization or browser state requires migration.
