import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { stockStatusFromQuantity } from '@/pages/products/productStockStatus';

interface Props {
  quantity: number;
}

export function ProductStockStatusBadge({ quantity }: Props): ReactElement {
  const { t } = useTranslation();
  const status = stockStatusFromQuantity(quantity);

  if (status === 'out') {
    return (
      <Badge variant="destructive">{t('products.stockStatus.out')}</Badge>
    );
  }
  if (status === 'low') {
    return (
      <Badge className="border-0 bg-amber-500 text-amber-950 hover:bg-amber-500/90 dark:bg-amber-600 dark:text-amber-50">
        {t('products.stockStatus.low')}
      </Badge>
    );
  }
  return (
    <Badge className="border-0 bg-emerald-600 text-white hover:bg-emerald-600/90 dark:bg-emerald-700">
      {t('products.stockStatus.ok')}
    </Badge>
  );
}
