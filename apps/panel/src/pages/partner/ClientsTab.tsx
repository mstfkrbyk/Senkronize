import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getApiErrorMessage } from '@/lib/api';
import type { PartnerRelationship, PartnerStatus } from '@/types/partner';

import { ClientCard } from './ClientCard';
import { InviteClientDialog } from './InviteClientDialog';
import { useMyClients } from './hooks/usePartner';

type FilterValue = 'all' | PartnerStatus;

export function ClientsTab(): ReactElement {
  const { data, isLoading, isError, error } = useMyClients();
  const [filter, setFilter] = useState<FilterValue>('all');

  const filtered = useMemo((): PartnerRelationship[] => {
    if (!data) {
      return [];
    }
    if (filter === 'all') {
      return data;
    }
    return data.filter((r) => r.status === filter);
  }, [data, filter]);

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

  const empty = !data?.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Müşterilerim</h2>
          <p className="text-sm text-muted-foreground">
            Partner olduğunuz firmaları yönetin.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={filter}
            onValueChange={(v) => setFilter(v as FilterValue)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Durum filtresi" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tümü</SelectItem>
              <SelectItem value="ACTIVE">Aktif</SelectItem>
              <SelectItem value="PENDING">Beklemede</SelectItem>
            </SelectContent>
          </Select>
          <InviteClientDialog
            trigger={<Button type="button">Yeni Müşteri Ekle</Button>}
          />
        </div>
      </div>

      {empty ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <p className="mb-4 text-muted-foreground">Henüz müşteriniz yok</p>
          <InviteClientDialog
            trigger={<Button type="button">Davet gönder</Button>}
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((rel) => (
            <ClientCard key={rel.id} relationship={rel} />
          ))}
        </div>
      )}

      {!empty && filtered.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground">
          Bu filtre için kayıt bulunamadı.
        </p>
      ) : null}
    </div>
  );
}
