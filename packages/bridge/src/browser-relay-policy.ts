import type { CdpTargetInfo } from '@panerelay/protocol';

const BROWSER_COOKIE_METHODS = new Set([
  'Network.getAllCookies',
  'Network.clearBrowserCookies',
  'Storage.getCookies',
  'Storage.clearCookies',
]);

function httpUrl(value: string | undefined): URL | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

function hasSameOrigin(targetUrl: URL, candidate: string): boolean {
  return httpUrl(candidate)?.origin === targetUrl.origin;
}

function cookieMutationPolicyError(targetUrl: URL, cookie: Record<string, unknown>): string | null {
  const cookieUrl = typeof cookie.url === 'string' ? cookie.url : undefined;
  const cookieDomain =
    typeof cookie.domain === 'string' ? cookie.domain.replace(/^\./, '').toLowerCase() : undefined;

  if (cookieUrl && !hasSameOrigin(targetUrl, cookieUrl)) {
    return 'Cookie mutation is limited to the selected Panerelay target origin';
  }
  if (cookieDomain && cookieDomain !== targetUrl.hostname.toLowerCase()) {
    return 'Cookie mutation is limited to the selected Panerelay target host';
  }
  if (!cookieUrl && !cookieDomain) {
    return 'Cookie mutation requires the selected Panerelay target URL or host';
  }
  return null;
}

export function targetCommandPolicyError(
  target: CdpTargetInfo | undefined,
  method: string,
  params: Record<string, unknown>,
): string | null {
  if (method.startsWith('Browser.')) {
    return `${method} requires browser-process ownership and is not supported by Panerelay`;
  }
  if (BROWSER_COOKIE_METHODS.has(method)) {
    return `${method} can access the entire daily Chrome profile and is not supported by Panerelay`;
  }

  const targetUrl = httpUrl(target?.url);
  if (!targetUrl) return null;

  if (method === 'Network.getCookies') {
    const urls = Array.isArray(params.urls) ? params.urls : [];
    if (urls.some(url => typeof url !== 'string' || !hasSameOrigin(targetUrl, url))) {
      return 'Network.getCookies is limited to the selected Panerelay target origin';
    }
  }

  if (method === 'Network.setCookie') {
    return cookieMutationPolicyError(targetUrl, params);
  }

  if (method === 'Network.setCookies') {
    if (!Array.isArray(params.cookies)) return 'Network.setCookies requires a cookie list';
    for (const cookie of params.cookies) {
      if (!cookie || typeof cookie !== 'object') {
        return 'Network.setCookies received an invalid cookie';
      }
      const error = cookieMutationPolicyError(targetUrl, cookie as Record<string, unknown>);
      if (error) return error;
    }
  }

  if (method === 'Network.deleteCookies') {
    return cookieMutationPolicyError(targetUrl, params);
  }

  if (
    method === 'Storage.clearDataForOrigin' &&
    (typeof params.origin !== 'string' || !hasSameOrigin(targetUrl, params.origin))
  ) {
    return 'Storage.clearDataForOrigin is limited to the selected Panerelay target origin';
  }

  return null;
}
