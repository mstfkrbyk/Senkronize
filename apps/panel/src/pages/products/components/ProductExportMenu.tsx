import type { ReactElement } from 'react';
import { useCallback, useState } from 'react';

import { ChevronDown, Download } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { api, getApiErrorMessage } from '@/lib/api';
import type { ProductExportColumn } from '@/types/product';

const EXPORT_COLUMNS: { id: ProductExportColumn; label: string }[] = [
  { id: 'barcode', label: 'Barkod' },
  { id: 'sku', label: 'SKU' },
  { id: 'name', label: 'Ürün adı' },
  { id: 'category', label: 'Kategori' },
  { id: 'salePrice', label: 'Satış fiyatı' },
  { id: 'listPrice', label: 'Liste fiyatı' },
  { id: 'stock', label: 'Stok' },
  { id: 'description', label: 'Açıklama' },
  { id: 'brand', label: 'Marka' },
  { id: 'costPrice', label: 'Maliyet' },
];

const DEFAULT_COLUMNS: ProductExportColumn[] = [
  'barcode',
  'sku',
  'name',
  'category',
  'salePrice',
  'listPrice',
  'stock',
  'description',
];

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

interface Props {
  selectedIds: string[];
}

export function ProductExportMenu({ selectedIds }: Props): ReactElement {
  const [columnDialogOpen, setColumnDialogOpen] = useState(false);
  const [pendingMode, setPendingMode] = useState<'all' | 'selected' | 'excel'>('all');
  const [columns, setColumns] = useState<ProductExportColumn[]>(DEFAULT_COLUMNS);
  const [exporting, setExporting] = useState(false);

  const runExport = useCallback(
    async (mode: 'all' | 'selected' | 'excel', cols: ProductExportColumn[]) => {
      setExporting(true);
      try {
        const params: Record<string, string> = {
          columns: cols.join(','),
        };
        if (mode === 'selected' && selectedIds.length > 0) {
          params.ids = selectedIds.join(',');
        }
        const res = await api.get<Blob>('/products/export', {
          params,
          responseType: 'blob',
        });
        const prefix = mode === 'selected' ? 'secili-urunler' : 'urunler';
        downloadBlob(
          new Blob([res.data], { type: 'text/csv;charset=utf-8;' }),
          `${prefix}.csv`,
        );
        toast.success('Dışa aktarma tamamlandı');
      } catch (err) {
        toast.error(getApiErrorMessage(err));
      } finally {
        setExporting(false);
        setColumnDialogOpen(false);
      }
    },
    [selectedIds],
  );

  const openColumnPicker = (mode: 'all' | 'selected' | 'excel'): void => {
    setPendingMode(mode);
    setColumnDialogOpen(true);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" size="sm" disabled={exporting}>
            <Download className="mr-2 size-4" />
            Dışa aktar
            <ChevronDown className="ml-1 size-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => {
              void runExport('all', DEFAULT_COLUMNS);
            }}
          >
            CSV (tüm ürünler)
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={selectedIds.length === 0}
            onClick={() => {
              void runExport('selected', DEFAULT_COLUMNS);
            }}
          >
            CSV (seçili ürünler)
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              openColumnPicker('excel');
            }}
          >
            Excel uyumlu CSV (sütun seçimi)
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              openColumnPicker('all');
            }}
          >
            Özel sütunlarla dışa aktar…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={columnDialogOpen} onOpenChange={setColumnDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dışa aktarma sütunları</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            {EXPORT_COLUMNS.map((col) => (
              <div key={col.id} className="flex items-center gap-2">
                <Checkbox
                  id={`export-col-${col.id}`}
                  checked={columns.includes(col.id)}
                  onCheckedChange={(checked) => {
                    setColumns((prev) =>
                      checked
                        ? [...prev, col.id]
                        : prev.filter((c) => c !== col.id),
                    );
                  }}
                />
                <Label htmlFor={`export-col-${col.id}`}>{col.label}</Label>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setColumnDialogOpen(false);
              }}
            >
              İptal
            </Button>
            <Button
              type="button"
              disabled={columns.length === 0 || exporting}
              onClick={() => {
                void runExport(pendingMode, columns);
              }}
            >
              İndir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
