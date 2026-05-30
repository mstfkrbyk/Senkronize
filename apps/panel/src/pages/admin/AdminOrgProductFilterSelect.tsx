import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import { Label } from '@/components/ui/label';
import { adminProductSelectionLabel } from '@/lib/admin-i18n-labels';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  type AdminOrgProductFilter,
  type AdminOrgProductFilterValue,
} from '@/lib/admin-org-product-filter';

interface AdminOrgProductFilterSelectProps {
  value: AdminOrgProductFilterValue;
  onValueChange: (value: AdminOrgProductFilterValue) => void;
  id?: string;
  className?: string;
}

export function AdminOrgProductFilterSelect({
  value,
  onValueChange,
  id = 'admin-product-filter',
  className,
}: AdminOrgProductFilterSelectProps): ReactElement {
  const { t } = useTranslation();

  return (
    <div className={className ?? 'space-y-1'}>
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {t('admin.common.productLine')}
      </Label>
      <Select
        value={value}
        onValueChange={(v) => {
          onValueChange(
            v === 'all' ? 'all' : (v as AdminOrgProductFilter),
          );
        }}
      >
        <SelectTrigger id={id} className="w-[180px] bg-background">
          <SelectValue placeholder={t('admin.common.productLine')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('admin.common.allProducts')}</SelectItem>
          {(['INTEGRATION', 'ACCOUNTING', 'BUNDLE'] as AdminOrgProductFilter[]).map(
            (key) => (
              <SelectItem key={key} value={key}>
                {adminProductSelectionLabel(key, t)}
              </SelectItem>
            ),
          )}
        </SelectContent>
      </Select>
    </div>
  );
}
