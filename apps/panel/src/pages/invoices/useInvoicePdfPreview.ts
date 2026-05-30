import { useCallback, useEffect, useMemo } from 'react';

import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';

import { api, getApiErrorMessage, parseJsonBlobMessage } from '@/lib/api';

import {
  downloadInvoicePdfBlob,
  fetchInvoicePdfBlob,
  InvoicePdfError,
} from './invoice-utils';
import { invoicesT } from './translations';

const PDF_STALE_MS = 5 * 60 * 1000;
const NEW_TAB_URL_TTL_MS = 120_000;

interface UseInvoicePdfPreviewOptions {
  invoiceId: string | null;
  invoiceNumber: string | undefined;
  enabled: boolean;
}

async function resolveInvoicePdfQueryError(error: unknown): Promise<InvoicePdfError> {
  if (error instanceof InvoicePdfError) {
    return error;
  }
  if (isAxiosError(error) && error.response?.data instanceof Blob) {
    const fromBlob = await parseJsonBlobMessage(error.response.data);
    return new InvoicePdfError(fromBlob ?? invoicesT('detail.pdfPreviewError'));
  }
  const message = getApiErrorMessage(error);
  if (message === 'Beklenmeyen bir hata oluştu.') {
    return new InvoicePdfError(invoicesT('detail.pdfPreviewError'));
  }
  return new InvoicePdfError(message);
}

export function useInvoicePdfPreview({
  invoiceId,
  invoiceNumber,
  enabled,
}: UseInvoicePdfPreviewOptions): {
  pdfUrl: string | null;
  isLoading: boolean;
  isError: boolean;
  errorMessage: string | null;
  download: () => void;
  openInNewTab: () => boolean;
} {
  const pdfQuery = useQuery({
    queryKey: ['invoices', 'pdf', invoiceId],
    enabled: enabled && !!invoiceId,
    staleTime: PDF_STALE_MS,
    queryFn: async (): Promise<Blob> => {
      try {
        return await fetchInvoicePdfBlob(invoiceId!, (url, cfg) =>
          api.get<Blob>(url, cfg),
        );
      } catch (error: unknown) {
        throw await resolveInvoicePdfQueryError(error);
      }
    },
  });

  const pdfUrl = useMemo(() => {
    if (!pdfQuery.data) {
      return null;
    }
    return URL.createObjectURL(pdfQuery.data);
  }, [pdfQuery.data]);

  useEffect(() => {
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [pdfUrl]);

  const download = useCallback((): void => {
    if (!pdfQuery.data || !invoiceNumber) {
      return;
    }
    downloadInvoicePdfBlob(pdfQuery.data, invoiceNumber);
  }, [pdfQuery.data, invoiceNumber]);

  const openInNewTab = useCallback((): boolean => {
    if (!pdfQuery.data) {
      return false;
    }
    const tabUrl = URL.createObjectURL(pdfQuery.data);
    const opened = window.open(tabUrl, '_blank', 'noopener,noreferrer');
    if (!opened) {
      URL.revokeObjectURL(tabUrl);
      return false;
    }
    window.setTimeout(() => {
      URL.revokeObjectURL(tabUrl);
    }, NEW_TAB_URL_TTL_MS);
    return true;
  }, [pdfQuery.data]);

  const isLoading =
    pdfQuery.isPending || (pdfQuery.isFetching && pdfQuery.data === undefined);

  const errorMessage = pdfQuery.isError
    ? getApiErrorMessage(pdfQuery.error) || invoicesT('detail.pdfPreviewError')
    : null;

  return {
    pdfUrl,
    isLoading,
    isError: pdfQuery.isError,
    errorMessage,
    download,
    openInNewTab,
  };
}
