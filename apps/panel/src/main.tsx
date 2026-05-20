import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '@/i18n';
import App from './App';
import 'react-day-picker/style.css';
import './index.css';
import { initAnalytics } from './lib/analytics';
import { initSentry } from './instrument';
import { initTheme } from './store/theme.store';

initSentry();
initAnalytics();
initTheme();

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => {
      /* kayıt başarısız — panel yine de çalışır */
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
