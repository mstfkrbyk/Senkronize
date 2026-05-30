import type { ReactElement } from 'react';
import { CheckCircle2, Plug, Store } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';

interface Props {
  onAddMarketplace: () => void;
  onAddEcommerce?: () => void;
}

const STEP_KEYS = [
  'emptyState.integration.connectionsStep1',
  'emptyState.integration.connectionsStep2',
  'emptyState.integration.connectionsStep3',
] as const;

export function IntegrationConnectionsEmptyState({
  onAddMarketplace,
  onAddEcommerce,
}: Props): ReactElement {
  const { t } = useTranslation();

  return (
    <EmptyState
      icon={Plug}
      title={t('emptyState.integration.connectionsTitle')}
      description={t('emptyState.integration.connectionsDescription')}
      actionSlot={
        <div className="flex w-full max-w-lg flex-col items-center gap-5">
          <ol className="w-full space-y-2 rounded-lg border border-sky-100 bg-sky-50/50 px-4 py-3 text-left text-sm text-foreground">
            {STEP_KEYS.map((key, index) => (
              <li key={key} className="flex items-start gap-2">
                <span
                  className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-semibold text-sky-800"
                  aria-hidden
                >
                  {index + 1}
                </span>
                <span>{t(key)}</span>
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button type="button" variant="default" size="lg" onClick={onAddMarketplace}>
              <Plug className="mr-2 h-4 w-4" aria-hidden />
              {t('connections.emptyMarketplaceAction')}
            </Button>
            {onAddEcommerce ? (
              <Button type="button" variant="outline" size="lg" onClick={onAddEcommerce}>
                <Store className="mr-2 h-4 w-4" aria-hidden />
                {t('connections.emptyEcommerceAction')}
              </Button>
            ) : null}
          </div>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
            {t('emptyState.integration.connectionsHint')}
          </p>
        </div>
      }
    />
  );
}
