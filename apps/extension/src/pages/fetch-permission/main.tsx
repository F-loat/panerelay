import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { FetchPermissionPage } from './page.js';
import './styles.css';

const root = document.querySelector<HTMLElement>('#root');
if (!root) throw new Error('Missing fetch permission root');

createRoot(root).render(
  <StrictMode>
    <FetchPermissionPage />
  </StrictMode>,
);
