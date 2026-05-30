import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import type { LucideIcon } from 'lucide-react';
import { Building2 } from 'lucide-react';

import { EmptyState } from '@/components/EmptyState';

interface Props {
  hasActiveFilters: boolean;
  emptyTitle: string;
  emptyDescription?: string;
  icon?: LucideIcon;
}

export function AdminListEmptyState({
  hasActiveFilters,
  emptyTitle,
  emptyDescription,
  icon = Building2,
}: Props): ReactElement {
  const { t } = useTranslation();

  return (
    <EmptyState
      icon={icon}
      title={
        hasActiveFilters
          ? t('emptyState.integration.filteredTitle')
          : emptyTitle
      }
      description={
        hasActiveFilters
          ? t('emptyState.integration.filteredDescription')
          : (emptyDescription ?? '')
      }
    />
  );
}
