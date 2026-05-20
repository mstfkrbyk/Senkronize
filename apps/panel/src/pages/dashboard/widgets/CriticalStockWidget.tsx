import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import { LowStockWidget } from '@/components/widgets/LowStockWidget';

export function CriticalStockWidget(): ReactElement {
  const { t } = useTranslation();

  return (
    <LowStockWidget
      showChart={false}
      limit={5}
      title={t('dashboard.criticalStock')}
      description={t('dashboard.criticalStockDesc')}
    />
  );
}
