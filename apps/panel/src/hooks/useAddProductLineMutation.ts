import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { api, getApiErrorMessage } from '@/lib/api';
import {
  productLinesToAddForCard,
  type SubscriptionProductLineCardId,
} from '@/pages/settings/subscription-product-lines.config';
import { useAuthStore } from '@/store/auth.store';
import type { MeResponse, OrgProductLine } from '@/types/auth';

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
        throw new Error(t('settings.subscriptionTab.productLines.nothingToAdd'));
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
    onSuccess: async (data) => {
      const org = useAuthStore.getState().currentOrg;
      if (org) {
        setOrg({ ...org, orgProducts: data.productLines });
      }

      queryClient.setQueryData<MeResponse>(['auth', 'me'], (prev) => {
        if (!prev) {
          return prev;
        }
        return {
          ...prev,
          organization: {
            ...prev.organization,
            orgProducts: data.productLines,
          },
        };
      });

      void queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      void queryClient.invalidateQueries({ queryKey: ['subscription'] });
      void queryClient.invalidateQueries({ queryKey: ['erp-connections'] });

      await queryClient.refetchQueries({ queryKey: ['auth', 'me'] });
      const me = queryClient.getQueryData<MeResponse>(['auth', 'me']);
      const currentOrg = useAuthStore.getState().currentOrg;
      if (me && currentOrg) {
        setOrg({
          ...currentOrg,
          orgProducts: me.organization.orgProducts,
          plan: me.organization.plan,
          accountingMode: me.organization.accountingMode,
        });
      }

      toast.success(t('settings.subscriptionTab.productLines.addSuccess'));
    },
    onError: (error: unknown) => {
      toast.error(
        t('settings.subscriptionTab.productLines.addError', {
          message: getApiErrorMessage(error),
        }),
      );
    },
  });
}
