import type { ErpProductImportMode, ErpProductImportOptions } from '@senkronize/shared';
import type { ErpSyncSettings } from '@prisma/client';

export function buildErpProductImportOptions(
  settings: Pick<ErpSyncSettings, 'productImportMode' | 'erpCategoryIds'>,
): ErpProductImportOptions {
  return {
    mode: settings.productImportMode as ErpProductImportMode,
    categoryIds: settings.erpCategoryIds,
  };
}
