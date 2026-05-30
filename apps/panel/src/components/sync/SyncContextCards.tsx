import type { ReactElement } from 'react';
import { Receipt, Server, ShoppingBag } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface SyncContextCardsProps {
  showErpContext: boolean;
  className?: string;
}

/** SyncLogs, geçmiş ve çakışma sayfalarında ortak üst bağlam kartları. */
export function SyncContextCards({
  showErpContext,
  className,
}: SyncContextCardsProps): ReactElement {
  const { t } = useTranslation();

  return (
    <div className={cn('grid gap-3 sm:grid-cols-2', className)}>
      <Card className="border-amber-200/80 bg-amber-50/40">
        <CardHeader className="flex flex-row items-start gap-3 space-y-0 pb-2">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-amber-200 bg-amber-500/10 text-amber-700">
            <ShoppingBag className="h-5 w-5" aria-hidden />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-base font-semibold text-primary">
              {t('sync.logs.context.ecommerceTitle')}
            </CardTitle>
            <CardDescription className="text-sm leading-relaxed">
              {t('sync.logs.context.ecommerceDescription')}
            </CardDescription>
          </div>
        </CardHeader>
      </Card>
      {showErpContext ? (
        <Card className="border-sky-200/80 bg-sky-50/40">
          <CardHeader className="flex flex-row items-start gap-3 space-y-0 pb-2">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-sky-200 bg-sky-500/10 text-sky-600">
              <Server className="h-5 w-5" aria-hidden />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-base font-semibold text-primary">
                {t('sync.logs.context.erpTitle')}
              </CardTitle>
              <CardDescription className="text-sm leading-relaxed">
                {t('sync.logs.context.erpDescription')}
              </CardDescription>
            </div>
          </CardHeader>
        </Card>
      ) : (
        <Card className="border-emerald-200/80 bg-emerald-50/40">
          <CardHeader className="flex flex-row items-start gap-3 space-y-0 pb-2">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-500/10 text-emerald-700">
              <Receipt className="h-5 w-5" aria-hidden />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-base font-semibold text-primary">
                {t('sync.logs.context.nativeTitle')}
              </CardTitle>
              <CardDescription className="text-sm leading-relaxed">
                {t('sync.logs.context.nativeDescription')}
              </CardDescription>
            </div>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
