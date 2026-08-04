import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SidepanelApp } from './app.js';
import { PROVIDER_KEY } from './i18n.js';
import { createProviderBootstrap, PROVIDER_CACHE_KEY } from './provider-selection.js';
import { browserSidepanelClient } from './sidepanel-client.js';
import './styles.css';

const root = document.querySelector<HTMLElement>('#root');
if (!root) throw new Error('Missing Side Panel root');
const sidepanelRoot = root;

async function mount(): Promise<void> {
  let bootstrap;
  try {
    const stored = await browserSidepanelClient.getStored([PROVIDER_KEY, PROVIDER_CACHE_KEY]);
    bootstrap = createProviderBootstrap(stored[PROVIDER_KEY], stored[PROVIDER_CACHE_KEY]);
  } catch {
    bootstrap = createProviderBootstrap(undefined, undefined);
  }
  createRoot(sidepanelRoot).render(
    <StrictMode>
      <SidepanelApp bootstrap={bootstrap} />
    </StrictMode>,
  );
}

void mount();
