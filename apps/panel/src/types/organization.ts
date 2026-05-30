import type { AccountingMode } from '@/types/auth';

export interface OrganizationDetail {
  id: string;
  slug: string;
  name: string;
  type: string;
  accountingMode: AccountingMode | null;
  logoUrl: string | null;
  taxNumber: string | null;
  taxOffice: string | null;
  address: string | null;
  city: string | null;
  onboardingCompleted: boolean;
  require2FA: boolean;
  createdAt: string;
  defaultCurrency: string;
  currencyPreferManualRates: boolean;
  currencyTcmbEnabled: boolean;
  currencyManualRates: Record<string, number> | null;
}
