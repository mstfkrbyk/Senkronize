import type { ReactElement } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { SettingsPageShell } from '@/components/settings/SettingsPageShell';
import { Button } from '@/components/ui/button';

import { WebhooksPanel } from './WebhooksPanel';

export function WebhooksTab(): ReactElement {
  const { t } = useTranslation();
  const [createSignal, setCreateSignal] = useState(0);

  return (
    <SettingsPageShell
      title="Webhooks"
      description="Dış sistemlere olayları anlık olarak iletin."
      maxWidth="max-w-3xl"
      actions={
        <Button type="button" onClick={() => setCreateSignal((n) => n + 1)}>
          {t('settings.webhooks.createButton')}
        </Button>
      }
    >
      <WebhooksPanel showHeader={false} openCreateSignal={createSignal} />
    </SettingsPageShell>
  );
}
