import { createGunzip } from 'node:zlib';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';
import type { FetchAdapterSourceProvenance } from '@panerelay/protocol';

const MAX_REDIRECTS = 3;
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_COMPRESSED_BYTES = 16 * 1024 * 1024;
const MAX_EXPANDED_BYTES = 64 * 1024 * 1024;
const MAX_ARCHIVE_ENTRIES = 2_048;
const MAX_ARCHIVE_FILE_BYTES = 8 * 1024 * 1024;
const MAX_ARCHIVE_PATH_DEPTH = 32;
const MAX_REF_BYTES = 256;
const MAX_SUBDIRECTORY_BYTES = 4 * 1024;

export type GitHubFetch = (
  input: string | URL | globalThis.Request,
  init?: RequestInit,
) => Promise<Response>;

export interface GitHubSource {
  repository: string;
  ref?: string;
  subdirectory?: string;
}

export interface GitHubResolutionOptions {
  fetch?: GitHubFetch;
  apiBaseUrl?: string;
  codeloadBaseUrl?: string;
}

export interface ResolvedGitHubSource {
  cleanup(): Promise<void>;
  directory: string;
  provenance: FetchAdapterSourceProvenance & { kind: 'github' };
}

function bounded(value: string, maximum: number): boolean {
  return value.length > 0 && Buffer.byteLength(value) <= maximum && !/\p{Cc}/u.test(value);
}

function validRepository(value: string): boolean {
  const match = /^([0-9A-Za-z](?:[0-9A-Za-z-]{0,37}[0-9A-Za-z])?)\/([0-9A-Za-z._-]{1,100})$/.exec(
    value,
  );
  return !!match && match[2] !== '.' && match[2] !== '..' && !match[2]?.endsWith('.git');
}

function validRef(value: string): boolean {
  return (
    bounded(value, MAX_REF_BYTES) &&
    /^[0-9A-Za-z][0-9A-Za-z._/-]*$/.test(value) &&
    !value.includes('..') &&
    !value.includes('//') &&
    !value.endsWith('/') &&
    !value.endsWith('.') &&
    value.split('/').every(segment => segment !== '.' && segment !== '..')
  );
}

function validSubdirectory(value: string): boolean {
  if (!bounded(value, MAX_SUBDIRECTORY_BYTES) || value.startsWith('/') || value.endsWith('/')) {
    return false;
  }
  if (value.includes('\\')) return false;
  const segments = value.split('/');
  return (
    segments.length <= MAX_ARCHIVE_PATH_DEPTH &&
    segments.every(
      segment =>
        segment !== '' && segment !== '.' && segment !== '..' && Buffer.byteLength(segment) <= 255,
    )
  );
}

function parseSelection(repository: string, suffix: string, subdirectory?: string): GitHubSource {
  let selectedRepository = repository;
  let ref: string | undefined;
  const at = suffix.indexOf('@');
  if (at >= 0) {
    if (suffix.slice(0, at)) throw new Error('GitHub source suffix is malformed');
    ref = suffix.slice(at + 1);
  } else if (suffix) {
    throw new Error('GitHub source suffix is malformed');
  }
  selectedRepository = selectedRepository.replace(/\.git$/i, '');
  if (!validRepository(selectedRepository)) throw new Error('GitHub repository is invalid');
  if (ref !== undefined && !validRef(ref)) throw new Error('GitHub ref is invalid');
  if (subdirectory !== undefined && !validSubdirectory(subdirectory)) {
    throw new Error('GitHub source subdirectory is invalid');
  }
  return {
    repository: selectedRepository,
    ...(ref ? { ref } : {}),
    ...(subdirectory ? { subdirectory } : {}),
  };
}

export function parseGitHubSource(value: string): GitHubSource | undefined {
  const explicit = value.startsWith('github:');
  const input = explicit ? value.slice('github:'.length) : value;
  if (/^https?:\/\//i.test(input)) {
    let url: URL;
    try {
      url = new URL(input);
    } catch {
      throw new Error('GitHub source URL is invalid');
    }
    if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== 'github.com') {
      if (explicit) throw new Error('GitHub source must use https://github.com');
      return undefined;
    }
    if (url.username || url.password || url.hash) throw new Error('GitHub source URL is unsafe');
    const segments = url.pathname.split('/').filter(Boolean);
    if (segments.length !== 2) throw new Error('GitHub source URL must identify one repository');
    const allowedQueries = new Set(['ref', 'path']);
    if ([...url.searchParams.keys()].some(key => !allowedQueries.has(key))) {
      throw new Error('GitHub source URL contains an unsupported query');
    }
    const refs = url.searchParams.getAll('ref');
    const paths = url.searchParams.getAll('path');
    if (refs.length > 1 || paths.length > 1) throw new Error('GitHub source URL repeats a query');
    const suffix = refs[0] ? `@${refs[0]}` : '';
    return parseSelection(`${segments[0]}/${segments[1]}`, suffix, paths[0] || undefined);
  }

  const hash = input.indexOf('#');
  const beforePath = hash >= 0 ? input.slice(0, hash) : input;
  const subdirectory = hash >= 0 ? input.slice(hash + 1) : undefined;
  const match = /^([^/@]+\/[^/@]+)(.*)$/.exec(beforePath);
  if (!match) {
    if (explicit) throw new Error('GitHub source shorthand is invalid');
    return undefined;
  }
  return parseSelection(match[1]!, match[2] ?? '', subdirectory);
}

function safeArchivePath(value: string): string[] {
  if (!value || value.startsWith('/') || value.includes('\\') || /\p{Cc}/u.test(value)) {
    throw new Error('GitHub archive contains an unsafe path');
  }
  const segments = value.split('/').filter((segment, index, values) => {
    return !(index === values.length - 1 && segment === '');
  });
  if (
    segments.length < 1 ||
    segments.length > MAX_ARCHIVE_PATH_DEPTH + 1 ||
    segments.some(
      segment =>
        segment === '' || segment === '.' || segment === '..' || Buffer.byteLength(segment) > 255,
    )
  ) {
    throw new Error('GitHub archive contains an unsafe path');
  }
  return segments;
}

function tarString(block: Buffer, start: number, length: number): string {
  const end = block.indexOf(0, start);
  return block
    .subarray(start, end >= start && end < start + length ? end : start + length)
    .toString('utf8');
}

function tarNumber(block: Buffer, start: number, length: number): number {
  const value = tarString(block, start, length).trim();
  if (!/^[0-7]+$/.test(value)) throw new Error('GitHub archive has invalid numeric metadata');
  const parsed = Number.parseInt(value, 8);
  if (!Number.isSafeInteger(parsed) || parsed < 0)
    throw new Error('GitHub archive size is invalid');
  return parsed;
}

function verifyTarChecksum(block: Buffer): void {
  const expected = tarNumber(block, 148, 8);
  let actual = 0;
  for (let index = 0; index < block.length; index += 1) {
    actual += index >= 148 && index < 156 ? 32 : block[index]!;
  }
  if (actual !== expected) throw new Error('GitHub archive checksum is invalid');
}

async function gunzipBounded(compressed: Buffer): Promise<Buffer> {
  const gunzip = createGunzip();
  const chunks: Buffer[] = [];
  let length = 0;
  Readable.from(compressed).pipe(gunzip);
  for await (const chunk of gunzip) {
    const value = Buffer.from(chunk as Uint8Array);
    length += value.length;
    if (length > MAX_EXPANDED_BYTES) {
      gunzip.destroy();
      throw new Error('GitHub archive exceeds the expanded byte limit');
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

async function extractArchive(compressed: Buffer, output: string): Promise<void> {
  const archive = await gunzipBounded(compressed);
  let offset = 0;
  let entries = 0;
  let rootSegment: string | undefined;
  const written = new Set<string>();
  while (offset + 512 <= archive.length) {
    const header = archive.subarray(offset, offset + 512);
    offset += 512;
    if (header.every(byte => byte === 0)) break;
    entries += 1;
    if (entries > MAX_ARCHIVE_ENTRIES) throw new Error('GitHub archive has too many entries');
    verifyTarChecksum(header);
    const prefix = tarString(header, 345, 155);
    const name = tarString(header, 0, 100);
    const archivePath = prefix ? `${prefix}/${name}` : name;
    const segments = safeArchivePath(archivePath);
    rootSegment ??= segments[0];
    if (segments[0] !== rootSegment) throw new Error('GitHub archive has multiple roots');
    const relativeSegments = segments.slice(1);
    const size = tarNumber(header, 124, 12);
    if (size > MAX_ARCHIVE_FILE_BYTES) throw new Error('GitHub archive contains an oversized file');
    const paddedSize = Math.ceil(size / 512) * 512;
    if (offset + paddedSize > archive.length) throw new Error('GitHub archive is truncated');
    const type = String.fromCharCode(header[156] ?? 0);
    if (type !== '\0' && type !== '0' && type !== '5') {
      throw new Error('GitHub archive contains a link or unsupported file type');
    }
    if (relativeSegments.length > 0) {
      const target = resolve(output, ...relativeSegments);
      const expectedPrefix = `${resolve(output)}${sep}`;
      if (!`${target}${type === '5' ? sep : ''}`.startsWith(expectedPrefix)) {
        throw new Error('GitHub archive path escapes extraction');
      }
      if (written.has(target)) throw new Error('GitHub archive contains duplicate paths');
      written.add(target);
      if (type === '5') {
        await mkdir(target, { recursive: true, mode: 0o700 });
      } else {
        await mkdir(dirname(target), { recursive: true, mode: 0o700 });
        await writeFile(target, archive.subarray(offset, offset + size), {
          mode: 0o600,
          flag: 'wx',
        });
      }
    }
    offset += paddedSize;
  }
  if (entries === 0 || !rootSegment) throw new Error('GitHub archive is empty');
}

async function responseBytes(response: Response): Promise<Buffer> {
  if (!response.body) throw new Error('GitHub archive response has no body');
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of response.body) {
    const value = Buffer.from(chunk as Uint8Array);
    length += value.length;
    if (length > MAX_COMPRESSED_BYTES) throw new Error('GitHub archive exceeds the download limit');
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

async function request(
  url: string,
  fetchImplementation: GitHubFetch,
  accept: string,
): Promise<Response> {
  let current = new URL(url);
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    timer.unref();
    let response: Response;
    try {
      response = await fetchImplementation(current, {
        headers: { accept, 'user-agent': 'panerelay-setup' },
        redirect: 'manual',
        signal: controller.signal,
      });
    } catch (error) {
      throw new Error(
        `GitHub request failed: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      );
    } finally {
      clearTimeout(timer);
    }
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    if (redirects === MAX_REDIRECTS) throw new Error('GitHub request exceeded the redirect limit');
    const location = response.headers.get('location');
    if (!location) throw new Error('GitHub redirect is missing its location');
    const next = new URL(location, current);
    if (next.protocol !== 'https:' || next.username || next.password) {
      throw new Error('GitHub redirect is unsafe');
    }
    current = next;
  }
  throw new Error('GitHub request failed');
}

async function githubJson(
  url: string,
  fetchImplementation: GitHubFetch,
  repository: string,
): Promise<Record<string, unknown>> {
  const response = await request(url, fetchImplementation, 'application/vnd.github+json');
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(
        `GitHub repository or ref is unavailable; private repositories are unsupported: ${repository}`,
      );
    }
    const remaining = response.headers.get('x-ratelimit-remaining');
    const reset = response.headers.get('x-ratelimit-reset');
    const rate = remaining === '0' ? ` (rate limit resets at ${reset ?? 'unknown'})` : '';
    throw new Error(`GitHub API returned HTTP ${response.status}${rate}: ${repository}`);
  }
  const value = (await response.json()) as unknown;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`GitHub API returned malformed metadata: ${repository}`);
  }
  return value as Record<string, unknown>;
}

export async function resolveGitHubSource(
  source: GitHubSource,
  options: GitHubResolutionOptions = {},
): Promise<ResolvedGitHubSource> {
  const fetchImplementation = options.fetch ?? fetch;
  const apiBase = (options.apiBaseUrl ?? 'https://api.github.com').replace(/\/$/, '');
  const codeloadBase = (options.codeloadBaseUrl ?? 'https://codeload.github.com').replace(
    /\/$/,
    '',
  );
  const [owner, repositoryName] = source.repository.split('/') as [string, string];
  let ref = source.ref;
  if (!ref) {
    const repository = await githubJson(
      `${apiBase}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repositoryName)}`,
      fetchImplementation,
      source.repository,
    );
    if (typeof repository.default_branch !== 'string' || !validRef(repository.default_branch)) {
      throw new Error(`GitHub repository default branch is invalid: ${source.repository}`);
    }
    ref = repository.default_branch;
  }
  const commit = await githubJson(
    `${apiBase}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repositoryName)}/commits/${encodeURIComponent(ref)}`,
    fetchImplementation,
    source.repository,
  );
  if (typeof commit.sha !== 'string' || !/^[0-9a-f]{40}$/.test(commit.sha)) {
    throw new Error(`GitHub commit metadata is invalid: ${source.repository}`);
  }
  const archiveResponse = await request(
    `${codeloadBase}/${encodeURIComponent(owner)}/${encodeURIComponent(repositoryName)}/tar.gz/${commit.sha}`,
    fetchImplementation,
    'application/octet-stream',
  );
  if (!archiveResponse.ok) {
    throw new Error(`GitHub archive returned HTTP ${archiveResponse.status}: ${source.repository}`);
  }
  const temporaryRoot = await mkdtemp(join(tmpdir(), 'panerelay-github-adapter-'));
  try {
    const repositoryRoot = join(temporaryRoot, 'repository');
    await mkdir(repositoryRoot, { mode: 0o700 });
    await extractArchive(await responseBytes(archiveResponse), repositoryRoot);
    const directory = source.subdirectory
      ? resolve(repositoryRoot, ...source.subdirectory.split('/'))
      : repositoryRoot;
    if (
      !`${directory}${sep}`.startsWith(`${repositoryRoot}${sep}`) &&
      directory !== repositoryRoot
    ) {
      throw new Error('GitHub source subdirectory escapes the repository');
    }
    return {
      directory,
      provenance: {
        kind: 'github',
        repository: source.repository,
        commit: commit.sha,
        ...(source.ref ? { ref: source.ref } : {}),
        ...(source.subdirectory ? { subdirectory: source.subdirectory } : {}),
      },
      cleanup: () => rm(temporaryRoot, { force: true, recursive: true }),
    };
  } catch (error) {
    await rm(temporaryRoot, { force: true, recursive: true });
    throw error;
  }
}
