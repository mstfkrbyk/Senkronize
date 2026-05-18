import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App';
import '@/i18n';
import 'react-day-picker/style.css';
import './index.css';
import { initAnalytics } from './lib/analytics';
import { initSentry } from './instrument';
import { initTheme } from './store/theme.store';

initSentry();
initAnalytics();
initTheme();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
