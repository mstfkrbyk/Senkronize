import type { NavGroupId } from '@/constants/navigation';
import type { AccountingMode } from '@/lib/accounting-mode';

/** Kenar çubuğu grup ipucu — accountingMode ile e-ticaret metni değişir */
export function resolveNavGroupHintKey(
  group: NavGroupId,
  mode: AccountingMode,
): string {
  if (group === 'ecommerce') {
    return mode === 'EXTERNAL_ERP'
      ? 'nav.groupHint.ecommerce.externalErp'
      : 'nav.groupHint.ecommerce.native';
  }
  return `nav.groupHint.${group}`;
}
