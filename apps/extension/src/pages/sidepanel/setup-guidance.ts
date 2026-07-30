const PANERELAY_SETUP_FAILURES = [
  /plugin ['"]panerelay['"] returned success=false/i,
  /(?:unknown|missing|not found|not installed|failed to load).{0,80}(?:plugin|provider) ['"]?panerelay/i,
  /(?:plugin|provider) ['"]?panerelay['"]?.{0,80}(?:unknown|missing|not found|not installed|failed to load)/i,
];

export function isPanerelaySetupFailure(value: string): boolean {
  return PANERELAY_SETUP_FAILURES.some(pattern => pattern.test(value));
}
