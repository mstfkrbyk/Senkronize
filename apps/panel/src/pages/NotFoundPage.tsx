import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { usePageTitle } from '@/hooks/usePageTitle';

export function NotFoundPage(): ReactElement {
  const { t } = useTranslation();
  usePageTitle(t('notFound.pageTitle'));

  return (
    <div className="mx-auto flex min-h-svh max-w-md flex-col justify-center space-y-6 bg-background p-6">
      <PageHeader
        title={t('notFound.title')}
        description={t('notFound.description')}
      />
      <Card className="w-full">
        <CardContent className="pt-6">
          <Button asChild className="w-full">
            <Link to="/dashboard">{t('notFound.backToPanel')}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
