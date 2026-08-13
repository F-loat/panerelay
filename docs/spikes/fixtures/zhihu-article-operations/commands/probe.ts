import {
  defineCommand,
  SiteError,
  type BrowserFetchRequest,
  type BrowserFetchResponse,
  type SiteCommandContext,
} from '@panerelay/site-kit';

const ORIGIN = 'https://zhuanlan.zhihu.com';
const CREATE_URL = `${ORIGIN}/api/articles/drafts`;
const FIRST_TITLE = 'Panerelay 私密草稿接口验证（可安全删除）';
const SECOND_TITLE = 'Panerelay 私密草稿接口验证（更新后，可安全删除）';
const FIRST_CONTENT = '<p>Panerelay private draft API probe. This draft must not be published.</p>';
const SECOND_CONTENT =
  '<p>Panerelay private draft API probe, updated. This draft must not be published.</p>';

type JsonObject = Record<string, unknown>;

function object(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : {};
}

function numericId(value: unknown): string {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return String(value);
  if (typeof value === 'string' && /^\d+$/.test(value)) return value;
  return '';
}

function responseId(response: BrowserFetchResponse): string {
  const body = object(response.body);
  return (
    numericId(body.id) ||
    numericId(object(body.data).id) ||
    numericId(object(body.article).id) ||
    numericId(object(object(body.data).article).id)
  );
}

function requireJson(response: BrowserFetchResponse, operation: string): JsonObject {
  if (response.status === 401 || response.status === 403) {
    throw new SiteError('auth-required', `Zhihu ${operation} requires an authenticated session`);
  }
  if (response.status < 200 || response.status >= 300) {
    throw new SiteError('upstream-failure', `Zhihu ${operation} returned HTTP ${response.status}`);
  }
  if (response.bodyType !== 'json') {
    throw new SiteError('shape-drift', `Zhihu ${operation} did not return JSON`);
  }
  return object(response.body);
}

function draftRequest(
  url: string,
  method: 'POST' | 'PATCH',
  body: JsonObject,
): BrowserFetchRequest {
  return {
    url,
    method,
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      origin: ORIGIN,
      referer: `${ORIGIN}/write`,
      'x-requested-with': 'fetch',
    },
    body: { encoding: 'utf8', data: JSON.stringify(body) },
    bindings: ['zhihu-article-probe-xsrf'],
    responseType: 'json',
    withCookies: true,
  };
}

async function removeDraft(context: SiteCommandContext, draftUrl: string): Promise<boolean> {
  const response = await context.fetch({
    url: draftUrl,
    method: 'DELETE',
    headers: {
      accept: 'application/json',
      origin: ORIGIN,
      referer: `${ORIGIN}/write`,
      'x-requested-with': 'fetch',
    },
    bindings: ['zhihu-article-probe-xsrf'],
    responseType: 'auto',
    withCookies: true,
  });
  return response.status >= 200 && response.status < 300;
}

export default defineCommand({
  name: 'probe',
  description: 'Create, read, update, verify, and delete one disposable private Zhihu draft.',
  access: 'write',
  args: [
    { name: 'execute', description: 'Confirm the disposable write sequence.', type: 'boolean' },
  ],
  output: ['created', 'read', 'updated', 'verified', 'deleted'],
  examples: ['panerelay zhihu-article-probe probe --execute'],
  async run(context, args) {
    if (args.execute !== true && String(args.execute ?? '').toLowerCase() !== 'true') {
      throw new SiteError('invalid-input', 'The Zhihu article probe requires --execute');
    }

    let draftId = '';
    let draftUrl = '';
    let operationError: unknown;
    let deleted = false;
    const result = { created: false, read: false, updated: false, verified: false, deleted: false };

    try {
      const created = await context.fetch(
        draftRequest(CREATE_URL, 'POST', {
          title: FIRST_TITLE,
          content: FIRST_CONTENT,
          delta_time: 1,
          table_of_contents: false,
        }),
      );
      requireJson(created, 'draft creation');
      draftId = responseId(created);
      if (!draftId) {
        throw new SiteError('shape-drift', 'Zhihu draft creation response did not contain an id');
      }
      draftUrl = `${ORIGIN}/api/articles/${draftId}/draft`;
      result.created = true;

      const read = await context.fetch({
        url: draftUrl,
        headers: { accept: 'application/json', referer: `${ORIGIN}/write` },
        responseType: 'json',
        withCookies: true,
      });
      const readBody = requireJson(read, 'draft read');
      if (numericId(readBody.id) !== draftId && responseId(read) !== draftId) {
        throw new SiteError('shape-drift', 'Zhihu draft read returned a different id');
      }
      result.read = true;

      const updated = await context.fetch(
        draftRequest(draftUrl, 'PATCH', {
          title: SECOND_TITLE,
          content: SECOND_CONTENT,
          delta_time: 1,
          table_of_contents: false,
        }),
      );
      requireJson(updated, 'draft update');
      result.updated = true;

      const verified = await context.fetch({
        url: draftUrl,
        headers: { accept: 'application/json', referer: `${ORIGIN}/write` },
        responseType: 'json',
        withCookies: true,
      });
      const verifiedBody = requireJson(verified, 'updated draft read');
      if (verifiedBody.title !== SECOND_TITLE || verifiedBody.content !== SECOND_CONTENT) {
        throw new SiteError('shape-drift', 'Zhihu did not return the updated draft fields');
      }
      result.verified = true;
    } catch (error) {
      operationError = error;
    } finally {
      if (draftUrl) {
        try {
          deleted = await removeDraft(context, draftUrl);
        } catch {
          deleted = false;
        }
      }
      result.deleted = deleted;
    }

    if (draftId && !deleted) {
      throw new SiteError(
        'command-failed',
        `Zhihu article probe could not delete disposable draft ${draftId}; remove it manually`,
      );
    }
    if (operationError) throw operationError;
    return [result];
  },
});
