import type { ReactElement } from 'react';
import { useState } from 'react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { getApiErrorMessage } from '@/lib/api';
import {
  useAdminPartnerLinkRequests,
  useApprovePartnerLinkRequest,
  useRejectPartnerLinkRequest,
} from '@/pages/partner/hooks/usePartnerLink';
import type { AdminPartnerLinkRequest } from '@/types/admin';

const STATUS_LABEL = {
  PENDING: 'Beklemede',
  APPROVED: 'Onaylandı',
  REJECTED: 'Reddedildi',
} as const;

function RequestTable({
  rows,
  showActions,
  onApprove,
  onReject,
  busyId,
}: {
  rows: AdminPartnerLinkRequest[];
  showActions: boolean;
  onApprove: (id: string) => void;
  onReject: (row: AdminPartnerLinkRequest) => void;
  busyId: string | null;
}): ReactElement {
  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">Kayıt bulunmuyor.</p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Müşteri</TableHead>
          <TableHead>Partner</TableHead>
          <TableHead>Tarih</TableHead>
          <TableHead>Mesaj</TableHead>
          <TableHead>Durum</TableHead>
          {showActions ? <TableHead className="text-right">İşlem</TableHead> : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell className="font-medium">{row.clientOrg.name}</TableCell>
            <TableCell>{row.partnerOrg.name}</TableCell>
            <TableCell>
              {format(new Date(row.requestedAt), 'd MMM yyyy HH:mm', { locale: tr })}
            </TableCell>
            <TableCell className="max-w-xs truncate text-muted-foreground">
              {row.message ?? '—'}
            </TableCell>
            <TableCell>
              <Badge
                variant={
                  row.status === 'PENDING'
                    ? 'secondary'
                    : row.status === 'APPROVED'
                      ? 'default'
                      : 'destructive'
                }
              >
                {STATUS_LABEL[row.status]}
              </Badge>
              {row.adminNote ? (
                <p className="mt-1 text-xs text-muted-foreground">{row.adminNote}</p>
              ) : null}
            </TableCell>
            {showActions ? (
              <TableCell className="space-x-2 text-right">
                <Button
                  type="button"
                  size="sm"
                  disabled={busyId === row.id}
                  onClick={() => onApprove(row.id)}
                >
                  Onayla
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busyId === row.id}
                  onClick={() => onReject(row)}
                >
                  Reddet
                </Button>
              </TableCell>
            ) : null}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function AdminPartnerLinksPage(): ReactElement {
  const pending = useAdminPartnerLinkRequests('PENDING');
  const historyApproved = useAdminPartnerLinkRequests('APPROVED');
  const historyRejected = useAdminPartnerLinkRequests('REJECTED');
  const approve = useApprovePartnerLinkRequest();
  const reject = useRejectPartnerLinkRequest();
  const [rejectRow, setRejectRow] = useState<AdminPartnerLinkRequest | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const history = [
    ...(historyApproved.data ?? []),
    ...(historyRejected.data ?? []),
  ].sort(
    (a, b) =>
      new Date(b.reviewedAt ?? b.requestedAt).getTime() -
      new Date(a.reviewedAt ?? a.requestedAt).getTime(),
  );

  const loading =
    pending.isLoading || historyApproved.isLoading || historyRejected.isLoading;

  const handleApprove = (id: string): void => {
    setBusyId(id);
    approve.mutate(id, {
      onSuccess: () => toast.success('Bağlantı talebi onaylandı'),
      onError: (err) => toast.error(getApiErrorMessage(err)),
      onSettled: () => setBusyId(null),
    });
  };

  const handleRejectSubmit = (): void => {
    if (!rejectRow) return;
    setBusyId(rejectRow.id);
    reject.mutate(
      { id: rejectRow.id, note: rejectNote.trim() || undefined },
      {
        onSuccess: () => {
          toast.success('Bağlantı talebi reddedildi');
          setRejectRow(null);
          setRejectNote('');
        },
        onError: (err) => toast.error(getApiErrorMessage(err)),
        onSettled: () => setBusyId(null),
      },
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Partner Bağlantıları</h2>
        <p className="text-sm text-muted-foreground">
          Müşterilerin partner bağlantı taleplerini onaylayın veya reddedin.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="size-8 animate-spin text-muted-foreground" aria-label="Yükleniyor" />
        </div>
      ) : (
        <Tabs defaultValue="pending">
          <TabsList>
            <TabsTrigger value="pending">
              Bekleyen
              {(pending.data?.length ?? 0) > 0 ? (
                <Badge className="ml-2" variant="secondary">
                  {pending.data?.length}
                </Badge>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="history">Geçmiş</TabsTrigger>
          </TabsList>
          <TabsContent value="pending" className="mt-4">
            <RequestTable
              rows={pending.data ?? []}
              showActions
              busyId={busyId}
              onApprove={handleApprove}
              onReject={(row) => {
                setRejectRow(row);
                setRejectNote('');
              }}
            />
          </TabsContent>
          <TabsContent value="history" className="mt-4">
            <RequestTable
              rows={history}
              showActions={false}
              busyId={busyId}
              onApprove={handleApprove}
              onReject={() => undefined}
            />
          </TabsContent>
        </Tabs>
      )}

      <Dialog open={rejectRow != null} onOpenChange={() => setRejectRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Talebi reddet</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-note">Admin notu (isteğe bağlı)</Label>
            <Textarea
              id="reject-note"
              rows={3}
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              placeholder="Müşteriye iletilecek kısa açıklama"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRejectRow(null)}>
              Vazgeç
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={reject.isPending}
              onClick={handleRejectSubmit}
            >
              Reddet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
