import { Package } from 'lucide-react';

import type { NavItem } from '@/constants/navigation';
import { getMarketplaceDisplay } from '@/lib/platform-display';

/** Kenar çubuğunda İlanlar alt menüsünü aktif bağlantılara göre oluşturur. */
export function injectListingsNavChildren(
  items: NavItem[],
  activePlatforms: string[],
): NavItem[] {
  if (activePlatforms.length === 0) {
    return items;
  }

  return items.map((item) => {
    if (item.path !== '/listings') {
      return item;
    }

    const children: NavItem[] = activePlatforms.map((platform) => {
      const display = getMarketplaceDisplay(platform);
      return {
        labelKey: 'nav.listings',
        label: display.label,
        icon: Package,
        path: '/listings',
        search: `?platform=${platform}`,
        group: item.group,
      };
    });

    return { ...item, children };
  });
}
