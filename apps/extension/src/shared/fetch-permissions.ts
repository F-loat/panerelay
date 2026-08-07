import { normalizeBrowserFetchDomain } from '@panerelay/protocol';
import { ALL_WEB_ORIGIN_PATTERNS } from './authorization.js';

export const FETCH_AUTHORIZED_DOMAINS_KEY = 'panerelay.fetch.authorizedDomains';
export const FETCH_AUTHORIZE_ALL_DOMAINS_KEY = 'panerelay.fetch.authorizeAllDomains';

export interface FetchAuthorizationState {
  allDomains: boolean;
  domains: string[];
}

export interface FetchPermissionStorage {
  get(keys: string[]): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

export function fetchDomainForUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (url.username || url.password) return null;
    return normalizeBrowserFetchDomain(url.hostname);
  } catch {
    return null;
  }
}

export function fetchDomainPermissionPatterns(domain: string): string[] | null {
  const normalized = normalizeBrowserFetchDomain(domain);
  return normalized === domain ? [`http://${domain}/*`, `https://${domain}/*`] : null;
}

function normalizedDomains(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value
        .filter((item): item is string => typeof item === 'string')
        .filter(item => normalizeBrowserFetchDomain(item) === item),
    ),
  ].sort();
}

function defaultStorage(): FetchPermissionStorage {
  return chrome.storage.local;
}

export async function readFetchAuthorization(
  storage: FetchPermissionStorage = defaultStorage(),
): Promise<FetchAuthorizationState> {
  const stored = await storage.get([FETCH_AUTHORIZED_DOMAINS_KEY, FETCH_AUTHORIZE_ALL_DOMAINS_KEY]);
  return {
    allDomains: stored[FETCH_AUTHORIZE_ALL_DOMAINS_KEY] === true,
    domains: normalizedDomains(stored[FETCH_AUTHORIZED_DOMAINS_KEY]),
  };
}

async function writeFetchAuthorization(
  state: FetchAuthorizationState,
  storage: FetchPermissionStorage,
): Promise<FetchAuthorizationState> {
  const normalized = {
    allDomains: state.allDomains,
    domains: normalizedDomains(state.domains),
  };
  await storage.set({
    [FETCH_AUTHORIZED_DOMAINS_KEY]: normalized.domains,
    [FETCH_AUTHORIZE_ALL_DOMAINS_KEY]: normalized.allDomains,
  });
  return normalized;
}

export async function grantFetchDomain(
  domain: string,
  storage: FetchPermissionStorage = defaultStorage(),
): Promise<FetchAuthorizationState> {
  const normalized = normalizeBrowserFetchDomain(domain);
  if (!normalized || normalized !== domain) throw new Error('Invalid browser fetch domain');
  const current = await readFetchAuthorization(storage);
  return writeFetchAuthorization(
    { ...current, domains: [...current.domains, normalized] },
    storage,
  );
}

export async function setFetchAllDomains(
  enabled: boolean,
  storage: FetchPermissionStorage = defaultStorage(),
): Promise<FetchAuthorizationState> {
  const current = await readFetchAuthorization(storage);
  return writeFetchAuthorization({ ...current, allDomains: enabled }, storage);
}

export async function revokeFetchDomain(
  domain: string,
  storage: FetchPermissionStorage = defaultStorage(),
): Promise<FetchAuthorizationState> {
  const normalized = normalizeBrowserFetchDomain(domain);
  if (!normalized || normalized !== domain) throw new Error('Invalid browser fetch domain');
  const current = await readFetchAuthorization(storage);
  return writeFetchAuthorization(
    { ...current, domains: current.domains.filter(item => item !== normalized) },
    storage,
  );
}

export function doesFetchDomainMatch(pattern: string, domain: string): boolean {
  if (pattern.startsWith('*.')) {
    const root = pattern.slice(2);
    return domain === root || domain.endsWith(`.${root}`);
  }
  return pattern === domain;
}

export function isFetchDomainAuthorized(domain: string, state: FetchAuthorizationState): boolean {
  const normalized = normalizeBrowserFetchDomain(domain);
  return (
    normalized === domain &&
    (state.allDomains || state.domains.some(pattern => doesFetchDomainMatch(pattern, domain)))
  );
}

export function fetchAuthorizationCommand(domain: string): string {
  return `panerelay fetch --authorize ${domain}`;
}

export function assertFetchUrlAuthorized(url: string, state: FetchAuthorizationState): string {
  const domain = fetchDomainForUrl(url);
  if (!domain) throw new Error('Browser fetch requires an absolute HTTP(S) URL');
  if (!isFetchDomainAuthorized(domain, state)) {
    throw new Error(
      `Browser fetch access to domain "${domain}" is not authorized. ` +
        `Ask the user to approve it, then run: ${fetchAuthorizationCommand(domain)}`,
    );
  }
  return domain;
}

export function fetchPermissionPatterns(
  scope: 'domain' | 'all-domains',
  domain?: string,
): string[] {
  if (scope === 'all-domains') return [...ALL_WEB_ORIGIN_PATTERNS];
  if (!domain) throw new Error('Invalid browser fetch domain');
  const patterns = fetchDomainPermissionPatterns(domain);
  if (!patterns) throw new Error('Invalid browser fetch domain');
  return patterns;
}
