import { useState } from 'react';
import { toast } from 'sonner';

import { api, getApiErrorMessage } from '@/lib/api';

type PdfKind = 'sales' | 'stock' | 'profit';

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function useReportPdfDownload(): {
  downloading: PdfKind | null;
  downloadPdf: (kind: PdfKind, period?: '7d' | '30d' | '90d') => Promise<void>;
} {
  const [downloading, setDownloading] = useState<PdfKind | null>(null);

  async function downloadPdf(
    kind: PdfKind,
    period: '7d' | '30d' | '90d' = '30d',
  ): Promise<void> {
    setDownloading(kind);
    try {
      const path =
        kind === 'sales'
          ? '/reports/pdf/sales'
          : kind === 'stock'
            ? '/reports/pdf/stock'
            : '/reports/pdf/profit';
      const res = await api.get(path, {
        params: kind === 'stock' ? undefined : { period },
        responseType: 'blob',
      });
      const filename =
        kind === 'sales'
          ? `satis-raporu-${period}.pdf`
          : kind === 'stock'
            ? 'stok-raporu.pdf'
            : `kar-raporu-${period}.pdf`;
      downloadBlob(new Blob([res.data as BlobPart], { type: 'application/pdf' }), filename);
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setDownloading(null);
    }
  }

  return { downloading, downloadPdf };
}
