import { useMemo } from 'react';
import type { SidepanelState } from '../sidepanel-controller.js';
import { formatCopy, translate, type CopyKey } from '../i18n.js';

export function useCopy(state: SidepanelState) {
  return useMemo(
    () => ({
      t: (key: CopyKey) => translate(state.locale, key),
      tf: (key: CopyKey, values: Record<string, string | number>) =>
        formatCopy(state.locale, key, values),
    }),
    [state.locale],
  );
}
