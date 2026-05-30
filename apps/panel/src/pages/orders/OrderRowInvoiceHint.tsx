import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';

import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { InvoiceStatusBadge } from '@/pages/invoices/InvoiceStatusBadge';
import type { InvoiceDto } from '@/types/invoice';

interface Props {
  orderId: string;
  invoice: InvoiceDto | null;
  loading?: boolean;
  creating?: boolean;
  onCreate: (orderId: string) => void;
}

export function OrderRowInvoiceHint({
  orderId,
  invoice,
  loading = false,
  creating = false,
  onCreate,
}: Props): ReactElement {
  const { t } = useTranslation();

  if (loading) {
    return <Skeleton className="h-5 w-14" aria-hidden />;
  }

  if (invoice) {
    return (
      <Link
        to={`/invoices?search=${encodeURIComponent(invoice.invoiceNumber)}`}
        className="inline-flex"
        title={t('orders.list.openInvoiceTitle', { no: invoice.invoiceNumber })}
        aria-label={t('orders.list.openInvoiceAria', { no: invoice.invoiceNumber })}
        onClick={(e) => {
          e.stopPropagation();
        }}
        onKeyDown={(e) => {
          e.stopPropagation();
        }}
      >
        <InvoiceStatusBadge status={invoice.status} className="text-xs" />
      </Link>
    );
  }

  return (
    <Button
      type="button"
      variant="link"
      className="h-auto p-0 text-xs font-normal"
      disabled={creating}
      title={t('orders.list.createInvoice')}
      aria-label={t('orders.list.createInvoice')}
      onClick={(e) => {
        e.stopPropagation();
        onCreate(orderId);
      }}
    >
      {creating ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
      ) : (
        t('orders.list.createInvoice')
      )}
    </Button>
  );
}
