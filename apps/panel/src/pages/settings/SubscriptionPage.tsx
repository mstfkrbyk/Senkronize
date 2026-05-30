import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { usePageTitle } from '@/hooks/usePageTitle';

import { SubscriptionTab } from './tabs/SubscriptionTab';

export function SubscriptionPage(): ReactElement {
  const { t } = useTranslation();
  usePageTitle(t('settings.subscription'));

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-primary">
          {t('settings.subscriptionTab.title')}
        </h1>
        <p className="text-muted-foreground">{t('settings.subscriptionTab.subtitle')}</p>
      </div>

      <SubscriptionTab showHeader={false} />

      <p className="text-sm text-muted-foreground">
        {t('settings.subscriptionSettingsTabHint')}{' '}
        <Link
          to="/settings?tab=subscription"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          {t('settings.subscriptionSettingsTabLink')}
        </Link>
      </p>
    </div>
  );
}
