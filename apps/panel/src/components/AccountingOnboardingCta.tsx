import type { ReactElement } from 'react';
import { FileText, Receipt } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface Props {
  /** Tam sayfa yerine kart içinde göster */
  variant?: 'card' | 'standalone';
  className?: string;
}

export function AccountingOnboardingCta({
  variant = 'standalone',
  className,
}: Props): ReactElement {
  const { t } = useTranslation();

  const content = (
    <EmptyState
      icon={Receipt}
      title={t('emptyState.accounting.onboardingTitle')}
      description={t('emptyState.accounting.onboardingDescription')}
      actionSlot={
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button type="button" variant="default" asChild>
            <Link to="/invoices">
              <FileText className="mr-2 h-4 w-4" aria-hidden />
              {t('emptyState.accounting.createInvoice')}
            </Link>
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link to="/connections">{t('emptyState.accounting.openConnections')}</Link>
          </Button>
        </div>
      }
    />
  );

  if (variant === 'card') {
    return (
      <Card className={cn('border-dashed bg-muted/20', className)}>
        <CardContent className="pt-8 pb-8">{content}</CardContent>
      </Card>
    );
  }

  return <div className={className}>{content}</div>;
}
