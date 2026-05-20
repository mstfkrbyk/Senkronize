import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

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
import type {
  ReportScheduleFormat,
  ReportScheduleFrequencyUi,
  ReportScheduleType,
} from '@/types/report';

import { useCreateReportSchedule } from './hooks/useReportScheduleMutations';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultReportType?: ReportScheduleType;
}

export function ReportScheduleModal({
  open,
  onOpenChange,
  defaultReportType = 'SALES',
}: Props): ReactElement {
  const createMutation = useCreateReportSchedule();
  const [frequency, setFrequency] = useState<ReportScheduleFrequencyUi>('WEEKLY');
  const [reportType, setReportType] = useState<ReportScheduleType>(defaultReportType);
  const [format, setFormat] = useState<ReportScheduleFormat>('PDF');
  const [emailsText, setEmailsText] = useState('');
  const [name, setName] = useState('');

  useEffect(() => {
    if (open) {
      setReportType(defaultReportType);
    }
  }, [open, defaultReportType]);

  function handleSave(): void {
    const emails = emailsText
      .split(/[,;\n]+/)
      .map((e) => e.trim())
      .filter(Boolean);
    createMutation.mutate(
      {
        reportType,
        frequency,
        format,
        emails,
        name: reportType === 'CUSTOM' || reportType === 'VAT' ? name : undefined,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          setEmailsText('');
          setName('');
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rapor zamanla</DialogTitle>
          <DialogDescription>
            Seçtiğiniz rapor belirtilen sıklıkta e-posta ile gönderilir.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="schedule-type">Rapor tipi</Label>
            <Select
              value={reportType}
              onValueChange={(v) => setReportType(v as ReportScheduleType)}
            >
              <SelectTrigger id="schedule-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SALES">Satış</SelectItem>
                <SelectItem value="VAT">KDV</SelectItem>
                <SelectItem value="PROFIT">Kâr-Zarar</SelectItem>
                <SelectItem value="CUSTOM">Özel</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(reportType === 'CUSTOM' || reportType === 'VAT') && (
            <div className="space-y-2">
              <Label htmlFor="schedule-name">Rapor adı</Label>
              <Input
                id="schedule-name"
                placeholder={
                  reportType === 'VAT' ? 'Aylık KDV raporu' : 'Özel rapor adı'
                }
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="schedule-frequency">Sıklık</Label>
            <Select
              value={frequency}
              onValueChange={(v) => setFrequency(v as ReportScheduleFrequencyUi)}
            >
              <SelectTrigger id="schedule-frequency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DAILY">Günlük</SelectItem>
                <SelectItem value="WEEKLY">Haftalık</SelectItem>
                <SelectItem value="MONTHLY">Aylık</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="schedule-format">Format</Label>
            <Select
              value={format}
              onValueChange={(v) => setFormat(v as ReportScheduleFormat)}
            >
              <SelectTrigger id="schedule-format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PDF">PDF</SelectItem>
                <SelectItem value="EXCEL">Excel</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="schedule-emails">Alıcı e-postalar</Label>
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
          <Button
            type="button"
            disabled={createMutation.isPending}
            onClick={handleSave}
          >
            {createMutation.isPending ? (
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
