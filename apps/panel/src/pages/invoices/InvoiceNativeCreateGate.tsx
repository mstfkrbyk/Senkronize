import type { ReactElement, ReactNode } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { useAccountingMode } from '@/hooks/useAccountingMode';

import { InvoicesExternalErpBanner } from './InvoicesExternalErpBanner';

interface Props {
  children: ReactNode;
}

export function useInvoiceNativeCreateAllowed(): {
  isLoading: boolean;
  isAllowed: boolean;
} {
  const { mode, isLoading } = useAccountingMode();
  return {
    isLoading,
    isAllowed: !isLoading && mode === 'NATIVE',
  };
}

/** NATIVE dışı modda (EXTERNAL_ERP) fatura oluşturma formu yerine bilgilendirme. */
export function InvoiceNativeCreateGate({ children }: Props): ReactElement {
  const { isLoading, isAllowed } = useInvoiceNativeCreateAllowed();

  if (isLoading) {
    return (
      <div className="space-y-2 py-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!isAllowed) {
    return <InvoicesExternalErpBanner />;
  }

  return <>{children}</>;
}
