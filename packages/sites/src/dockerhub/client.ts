import type { BrowserFetchRequest, SiteCommandContext } from '@panerelay/site-kit';

export const BASE = 'https://hub.docker.com/v2';
type RecordValue = Record<string, unknown>;

export function text(value: unknown): string {
  return String(value ?? '').trim();
}

export function required(value: unknown, label: string): string {
  const result = text(value);
  if (!result) throw new Error(`dockerhub ${label} cannot be empty`);
  return result;
}

export function boundedLimit(value: unknown, fallback: number): number {
  const result = value == null || value === '' ? fallback : Number(value);
  if (!Number.isInteger(result) || result < 1 || result > 100)
    throw new Error('dockerhub limit must be an integer between 1 and 100');
  return result;
}

export function parseImage(value: unknown): { owner: string; name: string } {
  const raw = required(value, 'image').toLowerCase();
  const parts = raw.split('/');
  const owner = parts.length === 1 ? 'library' : parts[0];
  const name = parts.length === 1 ? parts[0] : parts[1];
  if (
    !owner ||
    !name ||
    parts.length > 2 ||
    !/^[a-z0-9][a-z0-9._-]*$/.test(owner) ||
    !/^[a-z0-9][a-z0-9._-]*$/.test(name)
  )
    throw new Error(`dockerhub image "${value}" is not valid`);
  if (name.length < 2 || name.length > 255)
    throw new Error(`dockerhub image "${value}" name must be 2-255 chars`);
  return { owner, name };
}

export function trimDate(value: unknown): string | null {
  const result = text(value);
  if (!result) return null;
  const normalized = result.replace(/\.\d+/, '');
  return normalized.endsWith('Z') ? normalized : `${normalized}Z`;
}

export function pick(value: unknown, key: string): unknown {
  return value && typeof value === 'object' ? (value as RecordValue)[key] : undefined;
}

export class DockerHubClient {
  readonly #context: SiteCommandContext;
  constructor(context: SiteCommandContext) {
    this.#context = context;
  }
  async json(path: string, query: Record<string, string | number> = {}): Promise<unknown> {
    const request: BrowserFetchRequest = {
      url: `${BASE}${path}`,
      query: Object.entries(query).map(([name, value]) => ({ name, value: String(value) })),
      responseType: 'json',
      withCookies: false,
    };
    const response = await this.#context.fetch(request);
    if (response.status === 404) throw new Error(`dockerhub resource not found: ${path}`);
    if (response.status === 429) throw new Error('dockerhub returned HTTP 429 (rate limited)');
    if (response.status < 200 || response.status >= 300 || response.bodyType !== 'json')
      throw new Error(`dockerhub request failed: HTTP ${response.status}`);
    return response.body;
  }
}
