import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';

import { ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { InvoiceErpStatusCell } from '@/pages/invoices/InvoiceErpStatusCell';
import { useInvoiceErpStatus } from '@/pages/invoices/useInvoiceErpStatus';

interface Props {
  orderId: string;
  loading?: boolean;
}

export function OrderRowErpHint({ orderId, loading = false }: Props): ReactElement {
  const { t } = useTranslation();
  const { getErpStatusForInvoice, isLoading: erpStatusLoading } = useInvoiceErpStatus();
  const erpStatus = getErpStatusForInvoice(orderId);
  const hasSent = erpStatus.some((e) => e.state === 'sent');
  const hasPending = erpStatus.some(
    (e) => e.state === 'pending' || e.state === 'no_order',
  );
  const hasConnection = erpStatus.some((e) => e.state !== 'not_connected');

  if (loading || erpStatusLoading) {
    return <Skeleton className="h-5 w-16" aria-hidden />;
  }

  if (hasSent) {
    return <InvoiceErpStatusCell items={erpStatus} compact />;
  }

  if (!hasConnection) {
    return (
      <Button
        type="button"
        variant="link"
        className="h-auto p-0 text-xs font-normal"
        title={t('orders.list.goToConnectionsTitle')}
        aria-label={t('orders.list.goToConnections')}
        asChild
      >
        <Link
          to="/connections?tab=erp"
          onClick={(e) => {
            e.stopPropagation();
          }}
          onKeyDown={(e) => {
            e.stopPropagation();
          }}
        >
          <ExternalLink className="mr-0.5 inline h-3 w-3" aria-hidden />
          {t('orders.list.goToConnections')}
        </Link>
      </Button>
    );
  }

  if (hasPending) {
    return (
      <Button
        type="button"
        variant="link"
        className="h-auto p-0 text-xs font-normal"
        title={t('orders.list.sendToErpTitle')}
        aria-label={t('orders.list.sendToErp')}
        asChild
      >
        <Link
          to={`/orders/${orderId}?tab=invoice`}
          onClick={(e) => {
            e.stopPropagation();
          }}
          onKeyDown={(e) => {
            e.stopPropagation();
          }}
        >
          {t('orders.list.sendToErp')}
        </Link>
      </Button>
    );
  }

  return <InvoiceErpStatusCell items={erpStatus} compact />;
}
