import { isConversationTargetHint, type ConversationTargetHint } from '@panerelay/protocol';

export const PANERELAY_PLAYWRIGHT_GATEWAY_PATH = '/cdp/playwright' as const;
export const PANERELAY_PLAYWRIGHT_GATEWAY_URL =
  `http://127.0.0.1:43827${PANERELAY_PLAYWRIGHT_GATEWAY_PATH}` as const;

export interface PlaywrightGatewaySelection {
  browserId: string;
  generation: string;
}

export type PlaywrightTargetGatewaySelection = ConversationTargetHint;

export type PlaywrightGatewayRouteSelection =
  PlaywrightGatewaySelection | PlaywrightTargetGatewaySelection;

function selectionToken(selection: PlaywrightGatewayRouteSelection): string {
  return Buffer.from(JSON.stringify(selection), 'utf8').toString('base64url');
}

export function playwrightGatewayUrl(selection?: PlaywrightGatewaySelection): string {
  return selection
    ? `${PANERELAY_PLAYWRIGHT_GATEWAY_URL}/browser/${selectionToken(selection)}`
    : PANERELAY_PLAYWRIGHT_GATEWAY_URL;
}

export function playwrightTargetGatewayUrl(selection: ConversationTargetHint): string {
  if (!isConversationTargetHint(selection)) {
    throw new Error('Invalid Panerelay Playwright target selection');
  }
  return `${PANERELAY_PLAYWRIGHT_GATEWAY_URL}/target/${selectionToken(selection)}`;
}

export function parsePlaywrightGatewaySelection(
  pathname: string,
): PlaywrightGatewayRouteSelection | null | undefined {
  if (
    pathname === `${PANERELAY_PLAYWRIGHT_GATEWAY_PATH}/json/version` ||
    pathname === `${PANERELAY_PLAYWRIGHT_GATEWAY_PATH}/json/version/`
  ) {
    return undefined;
  }
  const browserPrefix = `${PANERELAY_PLAYWRIGHT_GATEWAY_PATH}/browser/`;
  const targetPrefix = `${PANERELAY_PLAYWRIGHT_GATEWAY_PATH}/target/`;
  const suffix = '/json/version';
  const slashSuffix = '/json/version/';
  const actualSuffix = pathname.endsWith(slashSuffix) ? slashSuffix : suffix;
  const prefix = pathname.startsWith(browserPrefix)
    ? browserPrefix
    : pathname.startsWith(targetPrefix)
      ? targetPrefix
      : undefined;
  if (!prefix || !pathname.endsWith(actualSuffix)) return null;
  const token = pathname.slice(prefix.length, -actualSuffix.length);
  if (!/^[A-Za-z0-9_-]+$/.test(token)) return null;
  try {
    const value = JSON.parse(Buffer.from(token, 'base64url').toString('utf8')) as unknown;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    if (prefix === targetPrefix) {
      return isConversationTargetHint(value) ? value : null;
    }
    const selection = value as Partial<PlaywrightGatewaySelection>;
    if (
      Object.keys(value).length !== 2 ||
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
