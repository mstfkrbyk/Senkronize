import { formatNavPageContext } from '@/lib/nav-page-context';

/** Harici ERP kurulum sihirbazı — sayfa etiketi (üst bağlam ve başlık). */
export const ERP_SETUP_PAGE_LABEL = 'Kurulum';

/** Üst bağlam: «{grup} > Kurulum» (ör. Entegrasyonlar > Kurulum). */
export function formatErpSetupNavContext(groupLabel: string): string {
  return formatNavPageContext(groupLabel, ERP_SETUP_PAGE_LABEL);
}
