import type { ReactElement } from 'react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { modKeyLabel } from '@/lib/platform';
import { useUiStore } from '@/store/ui.store';

interface ShortcutRow {
  keys: string;
  description: string;
}

const mod = modKeyLabel();

const NAV_SHORTCUTS: ShortcutRow[] = [
  { keys: 'g d', description: 'Gösterge paneli' },
  { keys: 'g o', description: 'Siparişler' },
  { keys: 'g p', description: 'Ürünler' },
  { keys: 'g s', description: 'Stok' },
  { keys: 'g r', description: 'Raporlar' },
  { keys: 'g c', description: 'Bağlantılar' },
  { keys: 'g l', description: 'İlanlar' },
  { keys: 'g f', description: 'Fiyatlandırma' },
  { keys: 'g m', description: 'Geçiş sihirbazı' },
];

const ACTION_SHORTCUTS: ShortcutRow[] = [
  { keys: `${mod} + K`, description: 'Komut paleti' },
  { keys: `${mod} + /`, description: 'Kısayol yardımı' },
  { keys: `${mod} + R`, description: 'Sayfayı yenile' },
  { keys: '/', description: 'Komut paleti (alternatif)' },
  { keys: 'n o', description: 'Siparişlere git' },
  { keys: '?', description: 'Kısayol yardımı' },
  { keys: `${mod} + B`, description: 'Kenar çubuğunu aç / kapat' },
  { keys: 'Esc', description: 'Açık pencereyi kapat' },
];

function ShortcutsTable({
  title,
  rows,
  ariaLabel,
}: {
  title: string;
  rows: ShortcutRow[];
  ariaLabel: string;
}): ReactElement {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <Table aria-label={ariaLabel}>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40%]">Tuşlar</TableHead>
            <TableHead>Açıklama</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={`${title}-${row.keys}`}>
              <TableCell className="font-mono text-xs">{row.keys}</TableCell>
              <TableCell className="text-sm">{row.description}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function KeyboardShortcutsModal(): ReactElement {
  const open = useUiStore((s) => s.shortcutsHelpOpen);
  const setOpen = useUiStore((s) => s.setShortcutsHelpOpen);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Klavye kısayolları</DialogTitle>
          <DialogDescription>
            Metin alanı veya form kontrolünde değilken kullanılabilir. İki tuşu arka
            arkaya yaklaşık bir saniye içinde girin (ör. g ardından o). Mod tuşu:{' '}
            <span className="font-mono font-medium text-foreground">{mod}</span>
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 sm:grid-cols-2">
          <ShortcutsTable
            title="Gezinme"
            rows={NAV_SHORTCUTS}
            ariaLabel="Gezinme kısayolları"
          />
          <ShortcutsTable
            title="Eylemler"
            rows={ACTION_SHORTCUTS}
            ariaLabel="Eylem kısayolları"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
