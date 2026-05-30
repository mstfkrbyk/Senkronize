import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { ProductMatchKeySelect } from '@/components/ProductMatchKeySelect';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { api, getApiErrorMessage } from '@/lib/api';
import {
  PRODUCT_MATCH_KEY_INHERIT,
  type OrganizationSettingsMatchKey,
  type ProductMatchKey,
  type ProductMatchKeySelectValue,
} from '@/lib/product-match-key';

interface Props {
  productId: string;
  value: ProductMatchKey | null | undefined;
}

export function ProductMatchKeyCard({ productId, value }: Props): ReactElement {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const orgSettingsQuery = useQuery({
    queryKey: ['organizations', 'settings'],
    queryFn: async (): Promise<OrganizationSettingsMatchKey> => {
      const { data } = await api.get<OrganizationSettingsMatchKey>('/organizations/settings');
      return data;
    },
  });
  const saveMutation = useMutation({
    mutationFn: async (productMatchKey: ProductMatchKey | null) => {
      await api.patch(`/products/${productId}`, { productMatchKey });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['products', productId] });
      toast.success(t('productMatching.matchKey.saved'));
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error));
    },
  });
  const selectValue: ProductMatchKeySelectValue =
    value ?? PRODUCT_MATCH_KEY_INHERIT;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('productMatching.matchKey.productTitle')}</CardTitle>
        <CardDescription>{t('productMatching.matchKey.productDescription')}</CardDescription>
      </CardHeader>
      <CardContent>
        <ProductMatchKeySelect
          showInherit
          orgDefault={orgSettingsQuery.data?.productMatchKey ?? null}
          value={selectValue}
          disabled={saveMutation.isPending || orgSettingsQuery.isLoading}
          onChange={(next) => {
            saveMutation.mutate(next === PRODUCT_MATCH_KEY_INHERIT ? null : next);
          }}
        />
      </CardContent>
    </Card>
  );
}
