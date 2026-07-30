import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SidepanelApp } from './app.js';
import './styles.css';

const root = document.querySelector<HTMLElement>('#root');
if (!root) throw new Error('Missing Side Panel root');

createRoot(root).render(
  <StrictMode>
    <SidepanelApp />
  </StrictMode>,
);
