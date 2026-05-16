import type { ReactElement } from 'react';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Copy, LogIn } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getApiErrorMessage } from '@/lib/api';
import { useImpersonationStore } from '@/store/impersonation.store';
import type { PartnerRelationship, PartnerStatus } from '@/types/partner';

import {
  useStartImpersonation,
  useTerminateRelationship,
} from './hooks/usePartner';

interface Props {
  relationship: PartnerRelationship;
}

const statusLabels: Record<PartnerStatus, string> = {
  PENDING: 'Beklemede',
  ACTIVE: 'Aktif',
  SUSPENDED: 'Askıda',
  TERMINATED: 'Sonlandı',
};

function statusVariant(
  status: PartnerStatus,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'ACTIVE':
      return 'default';
    case 'PENDING':
      return 'secondary';
    case 'SUSPENDED':
      return 'outline';
    case 'TERMINATED':
      return 'destructive';
    default:
      return 'outline';
  }
}

export function ClientCard({ relationship }: Props): ReactElement {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const startImpersonation = useImpersonationStore((s) => s.startImpersonation);
  const startImp = useStartImpersonation();
  const terminate = useTerminateRelationship();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const client = relationship.clientOrg;
  const title = client?.name ?? 'Müşteri';
  const slug = client?.slug ?? '—';

  async function handleImpersonate(): Promise<void> {
    if (!client) {
      return;
    }
    try {
      const { impersonationToken } = await startImp.mutateAsync(client.id);
      startImpersonation({ id: client.id, name: client.name }, impersonationToken);
      await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      navigate('/dashboard');
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error));
    }
  }

  async function handleCopyInvite(): Promise<void> {
    const url = relationship.inviteUrl;
    if (!url) {
      toast.error('Kopyalanacak davet bağlantısı bulunamadı.');
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Davet bağlantısı kopyalandı.');
    } catch {
      toast.error('Panoya kopyalanamadı.');
    }
  }

  return (
    <>
      <Card className="flex flex-col">
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <CardTitle className="text-lg">{title}</CardTitle>
            <Badge variant={statusVariant(relationship.status)}>
              {statusLabels[relationship.status]}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">@{slug}</p>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-2 pb-2">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">Komisyon %{relationship.commissionPct}</Badge>
            {relationship.status === 'PENDING' ? (
              <Badge variant="secondary">Davet Bekleniyor</Badge>
            ) : null}
          </div>
        </CardContent>
        <CardFooter className="mt-auto flex flex-wrap gap-2 border-t pt-4">
          {relationship.status === 'PENDING' ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!relationship.inviteUrl}
              onClick={() => void handleCopyInvite()}
            >
              <Copy className="mr-1 size-4" />
              Daveti Kopyala
            </Button>
          ) : null}
          {relationship.status === 'ACTIVE' &&
          relationship.canImpersonate &&
          client ? (
            <Button
              type="button"
              size="sm"
              disabled={startImp.isPending}
              onClick={() => void handleImpersonate()}
            >
              <LogIn className="mr-1 size-4" />
              Hesabına Geç
            </Button>
          ) : null}
          {relationship.status !== 'TERMINATED' ? (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={terminate.isPending}
              onClick={() => setConfirmOpen(true)}
            >
              İlişkiyi Sonlandır
            </Button>
          ) : null}
        </CardFooter>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>İlişkiyi sonlandır</AlertDialogTitle>
            <AlertDialogDescription>
              {title} ile partner ilişkisini sonlandırmak istediğinize emin misiniz?
              Bu işlem geri alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={terminate.isPending}
              onClick={() => {
                terminate.mutate(relationship.id, {
                  onSuccess: () => setConfirmOpen(false),
                  onError: (error: unknown) => {
                    toast.error(getApiErrorMessage(error));
                  },
                });
              }}
            >
              Sonlandır
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
