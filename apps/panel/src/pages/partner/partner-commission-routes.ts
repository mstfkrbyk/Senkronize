export type CommissionTab = 'ozet' | 'rapor' | 'gecmis' | 'talepler';

export const PARTNER_COMMISSION_PATH = '/partner/commission';
export const PARTNER_COMMISSION_REPORT_PATH = '/partner/commission-report';
export const PARTNER_COMMISSION_REPORT_SEARCH = '?tab=rapor';

export function partnerCommissionTabPath(tab: CommissionTab): string {
  return tab === 'rapor' ? PARTNER_COMMISSION_REPORT_PATH : PARTNER_COMMISSION_PATH;
}

/** Kenar çubuğu — CommissionPage pathname kuralları ile aynı */
export function isPartnerCommissionNavActive(
  navPath: string,
  pathname: string,
): boolean {
  if (navPath === PARTNER_COMMISSION_REPORT_PATH) {
    return pathname === PARTNER_COMMISSION_REPORT_PATH;
  }
  if (navPath === PARTNER_COMMISSION_PATH) {
    return pathname === PARTNER_COMMISSION_PATH;
  }
  return false;
}
