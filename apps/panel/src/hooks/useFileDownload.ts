import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import { api, getApiErrorMessage } from '@/lib/api';

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export interface FileDownloadOptions {
  key: string;
  url: string;
  params?: Record<string, string | number | boolean | undefined>;
  filename: string;
  mimeType?: string;
}

export function useFileDownload(): {
  downloading: string | null;
  download: (options: FileDownloadOptions) => Promise<void>;
} {
  const [downloading, setDownloading] = useState<string | null>(null);

  const download = useCallback(async (options: FileDownloadOptions): Promise<void> => {
    setDownloading(options.key);
    try {
      const res = await api.get(options.url, {
        params: options.params,
        responseType: 'blob',
      });
      const contentType =
        options.mimeType ??
        (typeof res.headers['content-type'] === 'string'
          ? res.headers['content-type']
          : 'application/octet-stream');
      const blob = new Blob([res.data as BlobPart], { type: contentType });
      triggerBlobDownload(blob, options.filename);
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setDownloading(null);
    }
  }, []);

  return { downloading, download };
}
