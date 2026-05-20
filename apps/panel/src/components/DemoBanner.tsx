import type { ReactElement } from 'react';

export function DemoBanner(): ReactElement | null {
  if (import.meta.env.VITE_DEMO_MODE !== 'true') {
    return null;
  }

  return (
    <div
      className="bg-yellow-400 py-2 text-center text-sm font-medium text-yellow-900"
      role="status"
    >
      🎯 Bu bir demo ortamıdır. Veriler gerçek değildir.{' '}
      <a
        href="https://senkronize.com"
        className="font-bold underline"
        target="_blank"
        rel="noopener noreferrer"
      >
        Gerçek hesap oluşturun →
      </a>
    </div>
  );
}
