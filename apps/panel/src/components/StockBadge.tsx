import type { ReactElement } from 'react';

import { Badge } from '@/components/ui/badge';

interface Props {
  quantity: number;
}

export function StockBadge({ quantity }: Props): ReactElement {
  const q = Number.isFinite(quantity) ? Math.max(0, Math.floor(quantity)) : 0;
  if (q === 0) {
    return <Badge variant="destructive">Tükendi</Badge>;
  }
  if (q <= 5) {
    return (
      <Badge className="border-0 bg-orange-500 text-white hover:bg-orange-500/90">
        Kritik ({q})
      </Badge>
    );
  }
  if (q <= 20) {
    return (
      <Badge className="border-0 bg-yellow-500 text-yellow-950 hover:bg-yellow-500/90">
        Düşük ({q})
      </Badge>
    );
  }
  return <Badge variant="outline">{q}</Badge>;
}
