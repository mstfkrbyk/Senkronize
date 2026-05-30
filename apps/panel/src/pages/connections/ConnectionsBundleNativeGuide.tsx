import type { ReactElement } from 'react';
import { Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Card, CardContent } from '@/components/ui/card';

export function ConnectionsBundleNativeGuide(): ReactElement {
  const { t } = useTranslation();

  return (
    <Card className="border-sky-200 bg-sky-50/70 text-sky-950 shadow-none">
      <CardContent className="flex gap-3 p-4 sm:p-5">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-sky-600" aria-hidden />
        <div className="min-w-0 space-y-1.5">
          <p className="text-sm font-semibold leading-snug text-sky-950">
            {t('connections.bundleNativeGuide.title')}
          </p>
          <p className="text-sm leading-relaxed text-sky-900/90">
            {t('connections.bundleNativeGuide.body')}
          </p>
          <p>
            <Link
              to="/accounting"
              className="text-sm font-medium text-sky-700 underline-offset-2 hover:underline"
            >
              {t('connections.bundleNativeGuide.accountingLink')}
            </Link>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
