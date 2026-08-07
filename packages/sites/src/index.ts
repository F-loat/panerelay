import { fileURLToPath } from 'node:url';

const BUILTIN_SITE_IDS = ['bilibili'] as const;

export type BuiltinSiteId = (typeof BUILTIN_SITE_IDS)[number];

export function builtinSiteIds(): BuiltinSiteId[] {
  return [...BUILTIN_SITE_IDS];
}

export function builtinSiteSources(): Record<BuiltinSiteId, string> {
  return {
    bilibili: fileURLToPath(new URL('./adapters/bilibili', import.meta.url)),
  };
}
