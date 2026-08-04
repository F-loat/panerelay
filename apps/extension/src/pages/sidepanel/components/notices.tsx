import { CircleAlert } from 'lucide-react';
import type { SidepanelController } from '../sidepanel-controller.js';
import { useCopy } from './presentation.js';

export function ProviderPreparationNotice({ controller }: { controller: SidepanelController }) {
  const { state } = controller;
  const { t, tf } = useCopy(state);
  const provider = state.providers.find(item => item.id === state.currentProviderId);
  const preparation = state.providerPreparations[state.currentProviderId];
  if (!provider || preparation?.status !== 'error') return null;

  return (
    <div className="provider-preparation-notice" role="status">
      <CircleAlert aria-hidden="true" />
      <span>
        <strong>{tf('providerPreparationFailed', { agent: provider.name })}</strong>
        <small>{preparation.error}</small>
      </span>
      <button onClick={() => void controller.retryProviderPreparation()} type="button">
        {t('providerPreparationRetry')}
      </button>
    </div>
  );
}
