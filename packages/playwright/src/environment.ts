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
    const value = JSON.parse(
      Buffer.from(token, 'base64url').toString('utf8'),
    ) as Partial<PlaywrightGatewaySelection>;
    if (
      typeof value.browserId !== 'string' ||
      value.browserId.length === 0 ||
      value.browserId.length > 128 ||
      typeof value.generation !== 'string' ||
      !/^[A-Za-z0-9._:-]{1,128}$/.test(value.generation)
    )
      return null;
    return { browserId: value.browserId, generation: value.generation };
  } catch {
    return null;
  }
}
