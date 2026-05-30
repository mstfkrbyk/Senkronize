import type { ReactElement, ReactNode } from 'react';
import { Info, Receipt, Server } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface Props {
  children?: ReactNode;
  className?: string;
  /** nativeNotice: NATIVE mod bilgi kutusu; externalBridge: harici köprü başlığı + içerik */
  variant?: 'nativeNotice' | 'externalBridge';
}

export function ErpBridgeSection({
  children,
  className,
  variant = 'externalBridge',
}: Props): ReactElement {
  const { t } = useTranslation();

  if (variant === 'nativeNotice') {
    return (
      <Alert
        className={className ?? 'border-emerald-200 bg-emerald-50/80 text-emerald-950'}
      >
        <Receipt className="h-5 w-5 text-emerald-600" aria-hidden />
        <AlertTitle className="text-emerald-950">
          {t('connections.erpBridge.infoTitle')}
        </AlertTitle>
        <AlertDescription className="text-emerald-900/90">
          <p>{t('connections.erpBridge.infoBody')}</p>
          <p className="mt-2 text-sm">
            <Info className="mr-1 inline h-3.5 w-3.5 align-text-bottom text-emerald-600" aria-hidden />
            {t('connections.erpBridge.infoHint')}
          </p>
          <p className="mt-2">
            <Link
              to="/accounting"
              className="font-medium text-emerald-700 underline-offset-2 hover:underline"
            >
              {t('connections.erpBridge.infoLinkLabel')}
            </Link>
          </p>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <section className={className ?? 'space-y-4'}>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-sky-200 bg-sky-500/10 text-sky-600">
          <Server className="h-5 w-5" aria-hidden />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight text-primary">
            {t('connections.erpBridge.title')}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t('connections.erpBridge.subtitle')}
          </p>
        </div>
      </div>
      {children}
    </section>
  );
}
