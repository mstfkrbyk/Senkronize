import { StrictMode } from 'react';
import type { ReactElement } from 'react';
import { createRoot } from 'react-dom/client';

const panelSrc = import.meta.env.DEV
  ? 'http://localhost:5173'
  : `${import.meta.env.BASE_URL}panel/index.html`;

export function App(): ReactElement {
  return (
    <div style={{ width: '100vw', height: '100vh', margin: 0, padding: 0 }}>
      <iframe
        title="Senkronize Panel"
        src={panelSrc}
        style={{ border: 'none', width: '100%', height: '100%' }}
      />
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
