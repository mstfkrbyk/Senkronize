import type { ReactElement } from 'react';
import { Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAccountingMode } from '@/hooks/useAccountingMode';

/** EXTERNAL_ERP: ERP aktarım açıklaması; NATIVE: gösterilmez. */
export function SyncAccountingModeBanner(): ReactElement | null {
  const { t } = useTranslation();
  const { mode, isLoading } = useAccountingMode();

  if (isLoading || mode !== 'EXTERNAL_ERP') {
    return null;
  }

  return (
    <Alert className="border-sky-200 bg-sky-50/80 text-sky-950">
      <Info className="h-4 w-4 text-sky-600" aria-hidden />
      <AlertTitle className="text-sky-950">{t('sync.banner.erpTitle')}</AlertTitle>
      <AlertDescription className="text-sky-900/90">
        <p>{t('sync.banner.erpDescription')}</p>
        <p className="mt-2">
          <Link
            to="/connections?tab=erp"
            className="font-medium text-sky-700 underline-offset-2 hover:underline"
          >
            {t('sync.banner.erpConnectionsLink')}
          </Link>
        </p>
      </AlertDescription>
    </Alert>
  );
}
