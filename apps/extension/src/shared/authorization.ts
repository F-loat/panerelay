export const ALL_WEB_ORIGIN_PATTERNS = ['http://*/*', 'https://*/*'] as const;

export interface OriginAuthorization {
  origin: string;
  permissionPattern: string;
}

function isChromeDebuggerRestrictedUrl(url: URL): boolean {
  return (
    (url.hostname === 'chrome.google.com' && url.pathname.startsWith('/webstore')) ||
    url.hostname === 'chromewebstore.google.com'
  );
}

export function originAuthorizationForUrl(value: string): OriginAuthorization | null {
  try {
    const url = new URL(value);
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      if (isChromeDebuggerRestrictedUrl(url)) return null;
      return {
        origin: url.origin,
        permissionPattern: `${url.origin}/*`,
      };
    }
    if (url.protocol === 'file:') {
      return {
        origin: 'file://',
        permissionPattern: 'file:///*',
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function isOriginEligible(
  url: string,
  mode: 'none' | 'single-tab' | 'all-tabs',
  authorizedOriginPatterns: readonly string[],
): boolean {
  const authorization = originAuthorizationForUrl(url);
  if (!authorization || mode === 'none') return false;
  if (mode === 'single-tab') {
    return authorizedOriginPatterns.includes(authorization.permissionPattern);
  }
  if (authorization.origin === 'file://') {
    return authorizedOriginPatterns.includes(authorization.permissionPattern);
  }
  return ALL_WEB_ORIGIN_PATTERNS.every(pattern => authorizedOriginPatterns.includes(pattern));
}
