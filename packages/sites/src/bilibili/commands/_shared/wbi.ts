import { createHash } from 'node:crypto';

const MIXIN_KEY_PERMUTATION = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49, 33, 9, 42, 19, 29, 28,
  14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54,
  21, 56, 59, 6, 63, 57, 62, 11, 36, 20, 34, 44, 52,
] as const;

export function imageKey(value: unknown, label: string): string {
  if (typeof value !== 'string') throw new Error(`Bilibili nav response is missing ${label}`);
  let filename: string;
  try {
    filename = new URL(value).pathname.split('/').pop() ?? '';
  } catch {
    throw new Error(`Bilibili nav response contains an invalid ${label}`);
  }
  const key = filename.split('.')[0] ?? '';
  if (!/^[A-Za-z0-9]{16,128}$/.test(key)) {
    throw new Error(`Bilibili nav response contains an invalid ${label}`);
  }
  return key;
}

function mixinKey(imgKey: string, subKey: string): string {
  const source = `${imgKey}${subKey}`;
  if (source.length <= Math.max(...MIXIN_KEY_PERMUTATION)) {
    throw new Error('Bilibili WBI keys are too short');
  }
  return MIXIN_KEY_PERMUTATION.map(index => source[index])
    .join('')
    .slice(0, 32);
}

function encodedQuery(params: Record<string, string>): string {
  return new URLSearchParams(params).toString().replaceAll('+', '%20');
}

export function signWbiQuery(
  params: Record<string, string>,
  imgKey: string,
  subKey: string,
  timestampSeconds: number,
): Record<string, string> {
  const normalized: Record<string, string> = { ...params, wts: String(timestampSeconds) };
  const sorted: Record<string, string> = {};
  for (const key of Object.keys(normalized).sort()) {
    sorted[key] = normalized[key]!.replace(/[!'()*]/g, '');
  }
  const wRid = createHash('md5')
    .update(`${encodedQuery(sorted)}${mixinKey(imgKey, subKey)}`)
    .digest('hex');
  return { ...sorted, w_rid: wRid };
}
