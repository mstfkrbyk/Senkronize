import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { api, getApiErrorMessage } from '@/lib/api';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultReportKind?: 'SALES' | 'STOCK' | 'PROFIT';
}

export function ReportScheduleModal({
  open,
  onOpenChange,
  defaultReportKind = 'SALES',
}: Props): ReactElement {
  const [frequency, setFrequency] = useState<'WEEKLY' | 'MONTHLY'>('WEEKLY');
  const [reportKind, setReportKind] = useState<'SALES' | 'STOCK' | 'PROFIT'>(
    defaultReportKind,
  );
  const [emailsText, setEmailsText] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setReportKind(defaultReportKind);
    }
  }, [open, defaultReportKind]);

  async function handleSave(): Promise<void> {
    const emails = emailsText
      .split(/[,;\n]+/)
      .map((e) => e.trim())
      .filter(Boolean);
    if (emails.length === 0) {
      toast.error('En az bir e-posta adresi girin.');
      return;
    }
    setSaving(true);
    try {
      await api.post('/reports/schedule', {
        reportKind,
        frequency,
        emails,
      });
      toast.success('Rapor zamanlaması kaydedildi.');
      onOpenChange(false);
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rapor Planla</DialogTitle>
          <DialogDescription>
            Seçtiğiniz rapor belirtilen sıklıkta e-posta ile gönderilir.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="schedule-frequency">Sıklık</Label>
            <Select
              value={frequency}
              onValueChange={(v) => setFrequency(v as 'WEEKLY' | 'MONTHLY')}
            >
              <SelectTrigger id="schedule-frequency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="WEEKLY">Haftalık (Pazartesi)</SelectItem>
                <SelectItem value="MONTHLY">Aylık (ayın 1&apos;i)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="schedule-kind">Rapor tipi</Label>
            <Select
              value={reportKind}
              onValueChange={(v) => setReportKind(v as 'SALES' | 'STOCK' | 'PROFIT')}
            >
              <SelectTrigger id="schedule-kind">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SALES">Satış</SelectItem>
                <SelectItem value="STOCK">Stok</SelectItem>
                <SelectItem value="PROFIT">Kâr</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="schedule-emails">E-posta adresleri</Label>
            <Input
              id="schedule-emails"
              placeholder="ornek@sirket.com, muhasebe@sirket.com"
              value={emailsText}
              onChange={(e) => setEmailsText(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Birden fazla adresi virgül veya satır ile ayırın.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            İptal
          </Button>
          <Button type="button" disabled={saving} onClick={() => void handleSave()}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Kaydediliyor…
              </>
            ) : (
              'Kaydet'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
