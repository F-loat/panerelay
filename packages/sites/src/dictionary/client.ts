import type { BrowserFetchRequest, SiteCommandContext } from '@panerelay/site-kit';

export const BASE = 'https://api.dictionaryapi.dev/api/v2/entries/en';
type Value = Record<string, unknown>;

export function pick(value: unknown, key: string): unknown {
  return value && typeof value === 'object' ? (value as Value)[key] : undefined;
}
export function word(value: unknown): string {
  const result = String(value ?? '').trim();
  if (!result) throw new Error('dictionary word cannot be empty');
  return result;
}
function text(value: unknown): string {
  return String(value ?? '').trim();
}
function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export class DictionaryClient {
  readonly #context: SiteCommandContext;
  constructor(context: SiteCommandContext) {
    this.#context = context;
  }
  async lookup(value: unknown): Promise<unknown> {
    const request: BrowserFetchRequest = {
      url: `${BASE}/${encodeURIComponent(word(value))}`,
      headers: { accept: 'application/json' },
      responseType: 'json',
      withCookies: false,
    };
    const response = await this.#context.fetch(request);
    if (response.status === 404) throw new Error(`dictionary word "${value}" was not found`);
    if (response.status < 200 || response.status >= 300 || response.bodyType !== 'json')
      throw new Error(`dictionary request failed: HTTP ${response.status}`);
    const body = response.body;
    if (!Array.isArray(body) || !body.length)
      throw new Error(`dictionary word "${value}" returned no definitions`);
    return body[0];
  }
}

export function firstEntry(body: unknown): Value {
  return body && typeof body === 'object' ? (body as Value) : {};
}
export function phonetic(body: unknown): string {
  const entry = firstEntry(body);
  const direct = text(pick(entry, 'phonetic'));
  if (direct) return direct;
  for (const item of list(pick(entry, 'phonetics'))) {
    const value = text(pick(item, 'text'));
    if (value) return value;
  }
  return '';
}
export function meanings(body: unknown): unknown[] {
  return list(pick(firstEntry(body), 'meanings'));
}
export function firstMeaning(body: unknown): Value {
  return (meanings(body)[0] ?? {}) as Value;
}
export function firstDefinition(body: unknown): Value {
  return (list(pick(firstMeaning(body), 'definitions'))[0] ?? {}) as Value;
}
export function synonyms(body: unknown): string {
  const values = new Set<string>();
  for (const meaning of meanings(body)) {
    for (const value of list(pick(meaning, 'synonyms'))) values.add(text(value));
    for (const definition of list(pick(meaning, 'definitions')))
      for (const value of list(pick(definition, 'synonyms'))) values.add(text(value));
  }
  const result = [...values].filter(Boolean).slice(0, 5).join(', ');
  return result || 'No synonyms found in API.';
}
export function example(body: unknown): string {
  return text(pick(firstDefinition(body), 'example')) || 'No example found in API.';
}
