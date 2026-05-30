import type { ReactElement } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { useAccountingMode } from '@/hooks/useAccountingMode';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useAuthStore } from '@/store/auth.store';

import { resolveSettingsProductAccess } from './settings-tabs.config';
import { SettingsIntegrationUpgrade } from './SettingsIntegrationUpgrade';
import { WebhooksPanel } from './tabs/WebhooksPanel';

export function WebhooksPage(): ReactElement {
  const { t } = useTranslation();
  usePageTitle(t('settings.webhooks.pageTitle'));
  const [createSignal, setCreateSignal] = useState(0);
  const orgProducts = useAuthStore((s) => s.currentOrg?.orgProducts);
  const { mode: accountingMode, isLoading: accountingModeLoading } =
    useAccountingMode();
  const { accountingOnly } = resolveSettingsProductAccess(orgProducts);

  if (accountingOnly) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t('settings.webhooks.pageTitle')}
          </h1>
        </div>
        <SettingsIntegrationUpgrade
          showNativeAccountingCta={
            accountingMode === 'NATIVE' && !accountingModeLoading
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
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
