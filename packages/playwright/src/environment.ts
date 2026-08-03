export const PANERELAY_PLAYWRIGHT_GATEWAY_PATH = '/cdp/playwright' as const;
export const PANERELAY_PLAYWRIGHT_GATEWAY_URL =
  `http://127.0.0.1:43827${PANERELAY_PLAYWRIGHT_GATEWAY_PATH}` as const;

export interface PlaywrightGatewaySelection {
  browserId: string;
  generation: string;
}

function selectionToken(selection: PlaywrightGatewaySelection): string {
  return Buffer.from(JSON.stringify(selection), 'utf8').toString('base64url');
}

export function playwrightGatewayUrl(selection?: PlaywrightGatewaySelection): string {
  return selection
    ? `${PANERELAY_PLAYWRIGHT_GATEWAY_URL}/browser/${selectionToken(selection)}`
    : PANERELAY_PLAYWRIGHT_GATEWAY_URL;
}

export function parsePlaywrightGatewaySelection(
  pathname: string,
): PlaywrightGatewaySelection | null | undefined {
  if (
    pathname === `${PANERELAY_PLAYWRIGHT_GATEWAY_PATH}/json/version` ||
    pathname === `${PANERELAY_PLAYWRIGHT_GATEWAY_PATH}/json/version/`
  ) {
    return undefined;
  }
  const prefix = `${PANERELAY_PLAYWRIGHT_GATEWAY_PATH}/browser/`;
  const suffix = '/json/version';
  const slashSuffix = '/json/version/';
  const actualSuffix = pathname.endsWith(slashSuffix) ? slashSuffix : suffix;
  if (!pathname.startsWith(prefix) || !pathname.endsWith(actualSuffix)) return null;
  const token = pathname.slice(prefix.length, -actualSuffix.length);
  if (!/^[A-Za-z0-9_-]+$/.test(token)) return null;
  try {
    const value = JSON.parse(Buffer.from(token, 'base64url').toString('utf8')) as unknown;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const selection = value as Partial<PlaywrightGatewaySelection>;
    if (
      typeof selection.browserId !== 'string' ||
      selection.browserId.length === 0 ||
      selection.browserId.length > 128 ||
      typeof selection.generation !== 'string' ||
      !/^[A-Za-z0-9._:-]{1,128}$/.test(selection.generation)
    )
      return null;
    return { browserId: selection.browserId, generation: selection.generation };
  } catch {
    return null;
  }
}
