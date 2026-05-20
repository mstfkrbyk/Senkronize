import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

import { api, getApiErrorMessage } from '@/lib/api';

export interface ShareReportPayload {
  emails?: string[];
  createLink?: boolean;
}

export interface ShareReportResult {
  shareUrl?: string;
  expiresAt?: string;
  emailsSent?: number;
}

export function useReportShare() {
  return useMutation<
    ShareReportResult,
    Error,
    { reportId: string; payload: ShareReportPayload }
  >({
    mutationFn: async ({ reportId, payload }) => {
      const { data } = await api.post<ShareReportResult>(
        `/reports/${reportId}/share`,
        payload,
      );
      return data;
    },
    onSuccess: (data) => {
      if (data.emailsSent && data.emailsSent > 0) {
        toast.success(`${data.emailsSent} alıcıya e-posta gönderildi.`);
      } else if (data.shareUrl) {
        toast.success('Paylaşım linki oluşturuldu.');
      } else {
        toast.success('Rapor paylaşıldı.');
      }
    },
    onError: (err: unknown) => {
      toast.error(getApiErrorMessage(err));
    },
  });
}
