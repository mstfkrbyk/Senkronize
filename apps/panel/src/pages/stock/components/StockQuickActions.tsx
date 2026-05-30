import type { ReactElement } from 'react';
import { useState } from 'react';

import { Link } from 'react-router-dom';
import {
  ArrowRightLeft,
  ClipboardList,
  FileSpreadsheet,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

import { BulkStockCsvDialog } from './BulkStockCsvDialog';

export function StockQuickActions(): ReactElement {
  const [csvOpen, setCsvOpen] = useState(false);

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Hızlı aksiyonlar</CardTitle>
          <CardDescription>
            Sık kullanılan stok işlemlerine tek tıkla erişin
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" asChild>
            <Link to="/products/count">
              <ClipboardList className="mr-2 size-4" aria-hidden />
              Stok sayımı başlat
            </Link>
          </Button>
          <Button type="button" variant="secondary" asChild>
            <Link to="/products?tab=transfers">
              <ArrowRightLeft className="mr-2 size-4" aria-hidden />
              Stok transferi oluştur
            </Link>
          </Button>
          <Button type="button" variant="outline" onClick={() => setCsvOpen(true)}>
            <FileSpreadsheet className="mr-2 size-4" aria-hidden />
            Toplu stok güncelle (CSV)
          </Button>
        </CardContent>
      </Card>

      <BulkStockCsvDialog open={csvOpen} onOpenChange={setCsvOpen} />
    </>
  );
}
