import type { ReactElement } from 'react';
import { useRef, useState } from 'react';

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
import { Label } from '@/components/ui/label';

import { useBulkStockUpdate } from '../hooks/useStockManagement';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function parseCsv(text: string): { barcode: string; quantity: number }[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) {
    return [];
  }

  const first = lines[0]?.toLowerCase() ?? '';
  const hasHeader =
    first.includes('barkod') ||
    first.includes('barcode') ||
    first.includes('sku');

  const dataLines = hasHeader ? lines.slice(1) : lines;
  const updates: { barcode: string; quantity: number }[] = [];

  for (const line of dataLines) {
    const sep = line.includes(';') ? ';' : ',';
    const parts = line.split(sep).map((p) => p.trim().replace(/^"|"$/g, ''));
    const barcode = parts[0] ?? '';
    const qtyRaw = parts[1] ?? parts[parts.length - 1] ?? '';
    const quantity = Number.parseInt(qtyRaw, 10);
    if (barcode.length === 0 || !Number.isFinite(quantity) || quantity < 0) {
      continue;
    }
    updates.push({ barcode, quantity });
  }

  return updates;
}

export function BulkStockCsvDialog({ open, onOpenChange }: Props): ReactElement {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewCount, setPreviewCount] = useState(0);
  const bulkMutation = useBulkStockUpdate();

  const handleFile = async (file: File): Promise<void> => {
    const text = await file.text();
    const updates = parseCsv(text);
    setPreviewCount(updates.length);
    if (updates.length === 0) {
      toast.error('CSV dosyasında geçerli satır bulunamadı.');
      return;
    }
    bulkMutation.mutate(updates, {
      onSuccess: (res) => {
        toast.success(
          `${String(updates.length)} ürün için stok güncelleme kuyruğa alındı.`,
        );
        if (res.jobIds.length > 0) {
          toast.message(`${String(res.jobIds.length)} platform işi oluşturuldu.`);
        }
        onOpenChange(false);
        setPreviewCount(0);
      },
      onError: () => {
        toast.error('Toplu güncelleme başarısız.');
      },
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          setPreviewCount(0);
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Toplu stok güncelleme</DialogTitle>
          <DialogDescription>
            CSV formatı: <code className="text-xs">barkod;miktar</code> veya{' '}
            <code className="text-xs">barkod,miktar</code>. İlk satır başlık
            olabilir.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="bulk-stock-csv">CSV dosyası</Label>
          <input
            ref={inputRef}
            id="bulk-stock-csv"
            type="file"
            accept=".csv,text/csv"
            className="block w-full text-sm file:mr-3 file:rounded-md file:border file:bg-muted file:px-3 file:py-1.5"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                void handleFile(file);
              }
            }}
          />
          {previewCount > 0 ? (
            <p className="text-muted-foreground text-sm">
              {previewCount.toLocaleString('tr-TR')} satır işleniyor…
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Kapat
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
