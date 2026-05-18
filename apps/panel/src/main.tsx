import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import 'react-day-picker/style.css';
import './index.css';
import { initTheme } from './store/theme.store';

initTheme();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
