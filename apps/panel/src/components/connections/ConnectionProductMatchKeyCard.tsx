import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
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
  normalizeProductMatchKeySelectValue,
  PRODUCT_MATCH_KEY_INHERIT,
  type OrganizationSettingsMatchKey,
  type ProductMatchKey,
  type ProductMatchKeySelectValue,
} from '@/lib/product-match-key';

interface Props {
  value: ProductMatchKey | null | undefined;
  disabled?: boolean;
  onSave: (productMatchKey: ProductMatchKey | null) => Promise<void>;
}

export function ConnectionProductMatchKeyCard({
  value,
  disabled,
  onSave,
}: Props): ReactElement {
  const { t } = useTranslation();
  const orgSettingsQuery = useQuery({
    queryKey: ['organizations', 'settings'],
    queryFn: async (): Promise<OrganizationSettingsMatchKey> => {
      const { data } = await api.get<OrganizationSettingsMatchKey>('/organizations/settings');
      return data;
    },
  });
  const selectValue: ProductMatchKeySelectValue =
    normalizeProductMatchKeySelectValue(value);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('productMatching.matchKey.platformTitle')}</CardTitle>
        <CardDescription>{t('productMatching.matchKey.platformDescription')}</CardDescription>
      </CardHeader>
      <CardContent>
        <ProductMatchKeySelect
          showInherit
          orgDefault={orgSettingsQuery.data?.productMatchKey ?? null}
          value={selectValue}
          disabled={disabled || orgSettingsQuery.isLoading}
          onChange={(next) => {
            const payload = next === PRODUCT_MATCH_KEY_INHERIT ? null : next;
            void onSave(payload).then(
              () => {
                toast.success(t('productMatching.matchKey.saved'));
              },
              (error) => {
                toast.error(getApiErrorMessage(error));
              },
            );
          }}
        />
      </CardContent>
    </Card>
  );
}
