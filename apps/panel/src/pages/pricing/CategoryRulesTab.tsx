import type { ReactElement } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  onOpenCreate: () => void;
}

export function CategoryRulesTab({ onOpenCreate }: Props): ReactElement {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-medium text-primary">Kategori ve marka kuralları</h2>
        <p className="text-sm text-muted-foreground">
          Toplu uygulama için kural oluştururken &quot;tüm ürünlere uygula&quot; seçeneğini
          kullanıp kategori, marka veya SKU deseni filtrelerini doldurun. Motor yalnızca eşleşen
          listelemelerde çalışır.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nasıl çalışır?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            <strong className="text-foreground">Kategori filtresi:</strong> Ürün kartındaki kategori
            alanında geçen metin (büyük/küçük harf duyarsız).
          </p>
          <p>
            <strong className="text-foreground">Marka filtresi:</strong> Ürün markası içerir
            eşleşmesi.
          </p>
          <p>
            <strong className="text-foreground">SKU deseni:</strong> Ürün SKU&apos;su veya barkod
            için JavaScript uyumlu düzenli ifade.
          </p>
        </CardContent>
      </Card>
      <Button type="button" onClick={onOpenCreate}>
        Kategori / marka kuralı oluştur
      </Button>
    </div>
  );
}
