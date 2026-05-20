import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { api, getApiErrorMessage } from '@/lib/api';
import {
  productLinesToAddForCard,
  type SubscriptionProductLineCardId,
} from '@/pages/settings/subscription-product-lines.config';
import { useAuthStore } from '@/store/auth.store';
import type { OrgProductLine } from '@/types/auth';

interface AddProductLineResponse {
  productLines: OrgProductLine[];
}

export function useAddProductLineMutation(orgProducts: OrgProductLine[] | undefined) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const setOrg = useAuthStore((s) => s.setOrg);

  return useMutation({
    mutationFn: async (
      cardId: SubscriptionProductLineCardId,
    ): Promise<AddProductLineResponse> => {
      const lines = productLinesToAddForCard(cardId, orgProducts);
      if (lines.length === 0) {
        throw new Error('Eklenecek ürün hattı yok.');
      }

      let last: AddProductLineResponse | undefined;
      for (const productLine of lines) {
        const { data } = await api.post<AddProductLineResponse>(
          '/subscription/add-product-line',
          { productLine },
        );
        last = data;
      }
      return last as AddProductLineResponse;
    },
    onSuccess: (data) => {
      const org = useAuthStore.getState().currentOrg;
      if (org) {
        setOrg({ ...org, orgProducts: data.productLines });
      }
      toast.success(t('settings.subscriptionTab.productLines.addSuccess'));
      void queryClient.invalidateQueries({ queryKey: ['subscription'] });
      void queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error));
    },
  });
}
