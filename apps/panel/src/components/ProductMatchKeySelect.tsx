import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  PRODUCT_MATCH_KEY_INHERIT,
  PRODUCT_MATCH_KEY_OPTIONS,
  type ProductMatchKey,
  type ProductMatchKeySelectValue,
} from '@/lib/product-match-key';

interface Props {
  id?: string;
  label?: string;
  description?: string;
  value: ProductMatchKeySelectValue;
  orgDefault?: ProductMatchKey | null;
  onChange: (value: ProductMatchKeySelectValue) => void;
  disabled?: boolean;
  showInherit?: boolean;
}

export function ProductMatchKeySelect({
  id = 'product-match-key',
  label,
  description,
  value,
  orgDefault,
  onChange,
  disabled,
  showInherit = false,
}: Props): ReactElement {
  const { t } = useTranslation();
  const resolvedLabel = label ?? t('productMatching.matchKey.label');
  const hintKey =
    value === PRODUCT_MATCH_KEY_INHERIT
      ? (orgDefault ?? 'notConfigured')
      : value;

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{resolvedLabel}</Label>
      {description ? (
        <p className="text-muted-foreground text-sm">{description}</p>
      ) : null}
      <Select
        value={value}
        disabled={disabled}
        onValueChange={(next) => {
          onChange(next as ProductMatchKeySelectValue);
        }}
      >
        <SelectTrigger id={id} className="max-w-md">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {showInherit ? (
            <SelectItem value={PRODUCT_MATCH_KEY_INHERIT}>
              {t('productMatching.matchKey.inheritOrg', {
                method: orgDefault
                  ? t(`productMatching.matchKey.options.${orgDefault}`)
                  : t('productMatching.matchKey.notConfigured'),
              })}
            </SelectItem>
          ) : null}
          {PRODUCT_MATCH_KEY_OPTIONS.map((option) => (
            <SelectItem key={option} value={option}>
              {t(`productMatching.matchKey.options.${option}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-muted-foreground text-xs">
        {t(`productMatching.matchKey.hint.${hintKey}`)}
      </p>
    </div>
  );
}
