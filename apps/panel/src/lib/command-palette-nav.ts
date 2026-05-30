import type { TFunction } from 'i18next';
import type { LucideIcon } from 'lucide-react';
import type { NavigateFunction } from 'react-router-dom';

import {
  flattenNavItemsForTitle,
  type NavGroupId,
  type NavItem,
} from '@/constants/navigation';
import {
  buildVisibleNavCatalog,
  shouldPlaceStockInEcommerce,
  shouldPlaceStockInNativeAccounting,
  type NavCatalogContext,
} from '@/lib/nav-match';
import { isStockPath } from '@/lib/org-products';

export const COMMAND_NAV_GROUP_ORDER: NavGroupId[] = [
  'ecommerce',
  'nativeAccounting',
  'externalErp',
  'common',
];

export interface PaletteNavCommand {
  id: string;
  title: string;
  icon: LucideIcon;
  navGroup?: NavGroupId;
  keywords: string[];
  action: () => void;
}

/** Ortak menü yaprakları — Ayarlar, Destek, Bildirimler, Denetim */
export const COMMON_PALETTE_NAV_PATHS = [
  '/notifications',
  '/support',
  '/settings',
  '/audit-logs',
] as const;

export function isCommonPaletteNavPath(pathname: string): boolean {
  return COMMON_PALETTE_NAV_PATHS.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** Ortak komutları — kenar çubuğu «Ortak» grubu ile aynı */
export function resolveCommonPaletteNavGroup(
  pathname: string,
): NavGroupId | undefined {
  return isCommonPaletteNavPath(pathname) ? 'common' : undefined;
}

/** Stok komutları — kenar çubuğu `nav-match` ile aynı grup başlığı */
export function resolveStockPaletteNavGroup(
  ctx: NavCatalogContext,
): NavGroupId | undefined {
  if (shouldPlaceStockInNativeAccounting(ctx)) {
    return 'nativeAccounting';
  }
  if (shouldPlaceStockInEcommerce(ctx)) {
    return 'ecommerce';
  }
  return undefined;
}

function paletteNavGroup(
  item: NavItem,
  ctx: NavCatalogContext,
): NavGroupId | undefined {
  const commonGroup = resolveCommonPaletteNavGroup(item.path);
  if (commonGroup) {
    return commonGroup;
  }
  if (isStockPath(item.path)) {
    return resolveStockPaletteNavGroup(ctx) ?? item.group;
  }
  return item.group;
}

function navItemTo(
  item: NavItem,
  navigate: NavigateFunction,
): void {
  if (item.search) {
    navigate({ pathname: item.path, search: item.search });
    return;
  }
  navigate(item.path);
}

/** Kenar çubuğu kataloğu ile aynı filtre — yaprak rotalar */
export function buildPaletteNavCommands(
  ctx: NavCatalogContext,
  t: TFunction,
  navigate: NavigateFunction,
  onClose: () => void,
): PaletteNavCommand[] {
  const catalog = buildVisibleNavCatalog(ctx);
  const stockGroup = resolveStockPaletteNavGroup(ctx);
  const leaves = flattenNavItemsForTitle(catalog).filter(
    (item) => !isStockPath(item.path) || stockGroup !== undefined,
  );
  const wrap =
    (fn: () => void) =>
    (): void => {
      onClose();
      fn();
    };

  return leaves.map((item) => {
    const title = t(item.labelKey);
    return {
      id: `nav-${item.path}${item.search ?? ''}`,
      title,
      icon: item.icon,
      navGroup: paletteNavGroup(item, ctx),
      keywords: [item.path, item.labelKey, title],
      action: wrap(() => navItemTo(item, navigate)),
    };
  });
}
