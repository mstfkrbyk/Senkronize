import type { AccountingMode, OrgProductLine } from '@/types/auth';

import { shouldPlaceStockInNativeAccounting } from '@/lib/nav-match';

export type ListingPushNoteKind = 'price' | 'stock';

export interface ListingPushNotesContext {
  accountingMode: AccountingMode;
  orgProducts: OrgProductLine[] | undefined;
}

export interface ListingPushNoteLink {
  to: string;
  labelKey: string;
}

/** i18n key under `listings.detail.push` */
export function resolveListingPushNoteKey(
  kind: ListingPushNoteKind,
  ctx: ListingPushNotesContext,
): string {
  if (kind === 'price') {
    return ctx.accountingMode === 'EXTERNAL_ERP'
      ? 'listings.detail.push.price.externalErp'
      : 'listings.detail.push.price.native';
  }

  if (shouldPlaceStockInNativeAccounting(ctx)) {
    return 'listings.detail.push.stock.nativeAccounting';
  }
  if (ctx.accountingMode === 'EXTERNAL_ERP') {
    return 'listings.detail.push.stock.externalErp';
  }
  return 'listings.detail.push.stock.nativeIntegration';
}

export function resolveListingPushNoteLink(
  kind: ListingPushNoteKind,
  ctx: ListingPushNotesContext,
): ListingPushNoteLink | null {
  if (kind !== 'stock') {
    return null;
  }

  if (shouldPlaceStockInNativeAccounting(ctx)) {
    return {
      to: '/products?tab=status',
      labelKey: 'listings.detail.push.stockLink.inventory',
    };
  }
  if (ctx.accountingMode === 'EXTERNAL_ERP') {
    return {
      to: '/connections?tab=erp',
      labelKey: 'listings.detail.push.stockLink.erp',
    };
  }
  return {
    to: '/products?tab=status',
    labelKey: 'listings.detail.push.stockLink.channel',
  };
}
