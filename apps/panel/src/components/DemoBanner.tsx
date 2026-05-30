import type { ReactElement } from 'react';

import { getDemoBannerMessage } from '@/lib/demo-banner-messages';
import { isDemoMode } from '@/lib/demo-login';
import { useAuthStore } from '@/store/auth.store';

export function DemoBanner(): ReactElement | null {
  const orgSlug = useAuthStore((s) => s.currentOrg?.slug);

  if (!isDemoMode()) {
    return null;
  }

  const message = getDemoBannerMessage(orgSlug);

  return (
    <div
      className="bg-yellow-400 py-2 text-center text-sm font-medium text-yellow-900"
      role="status"
    >
      🎯 {message}{' '}
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
