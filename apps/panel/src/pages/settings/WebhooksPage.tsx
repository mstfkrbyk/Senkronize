import type { ReactElement } from 'react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';

import { WebhooksPanel } from './tabs/WebhooksPanel';

export function WebhooksPage(): ReactElement {
  const { t } = useTranslation();
  const [createSignal, setCreateSignal] = useState(0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link to="/settings?tab=webhooks" className="hover:underline">
              {t('settings.title')}
            </Link>
            {' / '}
            <span className="text-foreground">{t('settings.webhooks.title')}</span>
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">{t('settings.webhooks.pageTitle')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('settings.webhooks.signatureHint')}{' '}
            <code className="text-xs">X-Senkronize-Signature-256: sha256=…</code>
          </p>
        </div>
        <Button type="button" onClick={() => setCreateSignal((n) => n + 1)}>
          {t('settings.webhooks.createButton')}
        </Button>
      </div>
      <WebhooksPanel showHeader={false} openCreateSignal={createSignal} />
    </div>
  );
}
