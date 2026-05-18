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
import { useUiStore } from '@/store/ui.store';

const NAV_SHORTCUTS: { keys: string; description: string }[] = [
  { keys: 'g d', description: 'Kontrol paneli' },
  { keys: 'g o', description: 'Siparişler' },
  { keys: 'g l', description: 'Listelemeler' },
  { keys: 'g s', description: 'Stok' },
  { keys: 'g p', description: 'Ürün kataloğu' },
  { keys: 'g f', description: 'Fiyatlandırma' },
  { keys: 'g r', description: 'Raporlar' },
  { keys: 'g c', description: 'Bağlantılar' },
  { keys: 'g m', description: 'Migrasyon' },
];

const ACTION_SHORTCUTS: { keys: string; description: string }[] = [
  { keys: 'Ctrl veya ⌘ + B', description: 'Kenar çubuğunu aç / kapat' },
  { keys: '/', description: 'Hızlı stok aramasını aç' },
  { keys: '?', description: 'Kısayol yardımı' },
  { keys: 'Esc', description: 'Bu pencereyi kapat' },
];

export function ShortcutsModal(): ReactElement {
  const open = useUiStore((s) => s.shortcutsHelpOpen);
  const setOpen = useUiStore((s) => s.setShortcutsHelpOpen);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Klavye kısayolları</DialogTitle>
          <DialogDescription>
            Metin alanı veya form kontrolünde değilken kullanılabilir. İki tuşu arka arkaya
            yaklaşık bir saniye içinde girin (ör. g ardından d).
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Gezinme</h3>
            <Table aria-label="Gezinme kısayolları">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40%]">Tuşlar</TableHead>
                  <TableHead>Hedef</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {NAV_SHORTCUTS.map((row) => (
                  <TableRow key={row.keys}>
                    <TableCell className="font-mono text-xs">{row.keys}</TableCell>
                    <TableCell className="text-sm">{row.description}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Eylemler</h3>
            <Table aria-label="Eylem kısayolları">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40%]">Tuşlar</TableHead>
                  <TableHead>Açıklama</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ACTION_SHORTCUTS.map((row) => (
                  <TableRow key={row.keys}>
                    <TableCell className="font-mono text-xs">{row.keys}</TableCell>
                    <TableCell className="text-sm">{row.description}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
