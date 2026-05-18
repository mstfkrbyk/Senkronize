import type { ReactElement } from 'react';
import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Download, Loader2, Play, Trash2, CalendarClock } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getApiErrorMessage } from '@/lib/api';

import { REPORT_TYPE_LABELS } from './customReportColumns';
import {
  downloadSavedReportExport,
  useDeleteSavedReport,
  useRunSavedReport,
  useSavedReportsList,
  useUpdateReportSchedule,
} from './hooks/useCustomReports';

function fmtDate(iso: string | null): string {
  if (!iso) {
    return '—';
  }
  try {
    return format(parseISO(iso), 'dd.MM.yyyy HH:mm');
  } catch {
    return '—';
  }
}

export function SavedReportsList(): ReactElement {
  const listQuery = useSavedReportsList();
  const deleteMut = useDeleteSavedReport();
  const runMut = useRunSavedReport();
  const scheduleMut = useUpdateReportSchedule();

  const [scheduleId, setScheduleId] = useState<string | null>(null);
  const [emails, setEmails] = useState('');
  const [frequency, setFrequency] = useState<'daily' | 'weekly'>('daily');

  async function onDownload(id: string): Promise<void> {
    try {
      await downloadSavedReportExport(id, 'csv');
      toast.success('İndirme başladı.');
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    }
  }

  async function onRun(id: string): Promise<void> {
    try {
      await runMut.mutateAsync(id);
      toast.success('Rapor çalıştırıldı.');
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    }
  }

  async function onDelete(id: string): Promise<void> {
    if (!window.confirm('Bu kayıtlı raporu silmek istediğinize emin misiniz?')) {
      return;
    }
    try {
      await deleteMut.mutateAsync(id);
      toast.success('Silindi.');
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    }
  }

  function openSchedule(id: string, existing: string): void {
    setScheduleId(id);
    setEmails(existing);
  }

  async function submitSchedule(): Promise<void> {
    if (!scheduleId) {
      return;
    }
    const parts = emails
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    try {
      await scheduleMut.mutateAsync({
        id: scheduleId,
        emails: parts,
        frequency,
        format: 'csv',
      });
      toast.success(parts.length === 0 ? 'Zamanlama kaldırıldı.' : 'Zamanlama kaydedildi.');
      setScheduleId(null);
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    }
  }

  if (listQuery.isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (listQuery.isError) {
    return (
      <p className="text-sm text-destructive">{getApiErrorMessage(listQuery.error)}</p>
    );
  }

  const rows = listQuery.data ?? [];

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Zamanlanmış raporlar her gece 00:00&apos;da (haftalıkta Pazartesi) gönderilir. E-posta boş bırakılırsa
        zamanlama kaldırılır.
      </p>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ad</TableHead>
              <TableHead>Tip</TableHead>
              <TableHead>Son çalışma</TableHead>
              <TableHead>Oluşturan</TableHead>
              <TableHead className="text-right">İşlemler</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Henüz kayıtlı rapor yok.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>{REPORT_TYPE_LABELS[r.reportType] ?? r.reportType}</TableCell>
                  <TableCell>{fmtDate(r.lastRunAt)}</TableCell>
                  <TableCell>
                    <span className="text-sm">{r.creatorName}</span>
                    <span className="block text-xs text-muted-foreground">{r.creatorEmail}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={runMut.isPending}
                        onClick={() => void onRun(r.id)}
                      >
                        {runMut.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                        <span className="sr-only sm:not-sr-only sm:ml-1">Çalıştır</span>
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => void onDownload(r.id)}
                      >
                        <Download className="h-4 w-4 sm:mr-1" />
                        <span className="sr-only sm:not-sr-only">İndir</span>
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          openSchedule(r.id, (r.schedule?.emails ?? []).join(', '))
                        }
                      >
                        <CalendarClock className="h-4 w-4 sm:mr-1" />
                        <span className="sr-only sm:not-sr-only">Programla</span>
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        disabled={deleteMut.isPending}
                        onClick={() => void onDelete(r.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={scheduleId !== null} onOpenChange={(o) => !o && setScheduleId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rapor zamanlama</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label>Sıklık</Label>
              <Select
                value={frequency}
                onValueChange={(v) => setFrequency(v as 'daily' | 'weekly')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Her gün (00:00)</SelectItem>
                  <SelectItem value="weekly">Her hafta Pazartesi (00:00)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>E-posta adresleri (virgül veya satır ile ayırın)</Label>
              <Input
                value={emails}
                onChange={(e) => setEmails(e.target.value)}
                placeholder="ornek@sirket.com"
              />
              <p className="text-xs text-muted-foreground">
                Boş bırakıp kaydederseniz zamanlama kaldırılır.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setScheduleId(null)}>
              Vazgeç
            </Button>
            <Button type="button" onClick={() => void submitSchedule()} disabled={scheduleMut.isPending}>
              {scheduleMut.isPending ? 'Kaydediliyor…' : 'Kaydet'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
