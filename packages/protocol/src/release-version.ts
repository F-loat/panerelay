export const PANERELAY_RELEASE_VERSION_MAX_LENGTH = 64;
export const PANERELAY_CHROMIUM_BUILD_VERSION_MAX_LENGTH = 23;

const RELEASE_VERSION_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-beta\.(0|[1-9]\d*))?$/;
const RELEASE_COMPONENT_MAXIMUM = 65_535;
const CHROMIUM_BUILD_VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export interface PanerelayReleaseVersion {
  raw: string;
  major: number;
  minor: number;
  patch: number;
  channel: 'stable' | 'beta';
  beta?: number;
}

function parseComponent(value: string): number | null {
  const component = Number(value);
  return Number.isSafeInteger(component) && component <= RELEASE_COMPONENT_MAXIMUM
    ? component
    : null;
}

export function parsePanerelayReleaseVersion(value: unknown): PanerelayReleaseVersion | null {
  if (typeof value !== 'string' || value.length > PANERELAY_RELEASE_VERSION_MAX_LENGTH) {
    return null;
  }
  const match = RELEASE_VERSION_PATTERN.exec(value);
  if (!match) return null;
  const major = parseComponent(match[1]!);
  const minor = parseComponent(match[2]!);
  const patch = parseComponent(match[3]!);
  const beta = match[4] === undefined ? undefined : parseComponent(match[4]);
  if (major === null || minor === null || patch === null || beta === null) return null;
  return {
    raw: value,
    major,
    minor,
    patch,
    channel: beta === undefined ? 'stable' : 'beta',
    ...(beta === undefined ? {} : { beta }),
  };
}

export function isPanerelayReleaseVersion(value: unknown): value is string {
  return parsePanerelayReleaseVersion(value) !== null;
}

export function isPanerelayChromiumBuildVersion(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > PANERELAY_CHROMIUM_BUILD_VERSION_MAX_LENGTH) {
    return false;
  }
  const match = CHROMIUM_BUILD_VERSION_PATTERN.exec(value);
  return Boolean(match?.slice(1).every(component => parseComponent(component) !== null));
}

export function comparePanerelayReleaseVersions(left: string, right: string): -1 | 0 | 1 {
  const parsedLeft = parsePanerelayReleaseVersion(left);
  const parsedRight = parsePanerelayReleaseVersion(right);
  if (!parsedLeft || !parsedRight) {
    throw new Error('Panerelay release comparison requires valid stable or beta versions');
  }
  for (const key of ['major', 'minor', 'patch'] as const) {
    if (parsedLeft[key] < parsedRight[key]) return -1;
    if (parsedLeft[key] > parsedRight[key]) return 1;
  }
  if (parsedLeft.channel !== parsedRight.channel) {
    return parsedLeft.channel === 'beta' ? -1 : 1;
  }
  if (parsedLeft.channel === 'beta' && parsedRight.channel === 'beta') {
    if (parsedLeft.beta! < parsedRight.beta!) return -1;
    if (parsedLeft.beta! > parsedRight.beta!) return 1;
  }
  return 0;
}
