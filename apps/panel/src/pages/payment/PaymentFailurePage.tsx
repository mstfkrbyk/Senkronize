import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePageTitle } from '@/hooks/usePageTitle';

export function PaymentFailurePage(): ReactElement {
  const { t } = useTranslation();
  usePageTitle(t('payment.failurePageTitle'));

  return (
    <div className="mx-auto min-h-[60vh] max-w-lg space-y-6 p-6">
      <PageHeader
        title={t('payment.failurePageTitle')}
        description={t('payment.failure.description')}
      />
      <Card className="w-full text-center">
        <CardHeader className="items-center space-y-3">
          <AlertCircle className="h-14 w-14 text-destructive" aria-hidden />
          <CardTitle className="text-2xl">{t('payment.failure.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild>
              <Link to="/settings/subscription">{t('payment.failure.retry')}</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/dashboard">{t('payment.failure.backToPanel')}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
