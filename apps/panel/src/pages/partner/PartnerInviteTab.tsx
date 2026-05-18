import type { ReactElement } from 'react';
import { useMemo } from 'react';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { getApiErrorMessage } from '@/lib/api';
import type { PartnerRelationship } from '@/types/partner';

import { ClientCard } from './ClientCard';
import { InviteClientDialog } from './InviteClientDialog';
import { useMyClients } from './hooks/usePartner';

export function PartnerInviteTab(): ReactElement {
  const { data, isLoading, isError, error } = useMyClients();

  const pending = useMemo((): PartnerRelationship[] => {
    if (!data) {
      return [];
    }
    return data.filter((r) => r.status === 'PENDING');
  }, [data]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-8 animate-spin text-muted-foreground" aria-label="Yükleniyor" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        {getApiErrorMessage(error)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Müşteri daveti</h2>
          <p className="text-sm text-muted-foreground">
            E-posta ile davet gönderin; davet bağlantısını veya kodu müşterinizle paylaşın.
          </p>
        </div>
        <InviteClientDialog
          trigger={<Button type="button">Yeni davet oluştur</Button>}
        />
      </div>

      <div>
        <h3 className="mb-3 text-sm font-medium text-muted-foreground">Bekleyen davetler</h3>
        {pending.length === 0 ? (
          <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
            Bekleyen davet yok.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pending.map((rel) => (
              <ClientCard key={rel.id} relationship={rel} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
