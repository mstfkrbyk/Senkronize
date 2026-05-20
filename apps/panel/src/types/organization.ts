export interface OrganizationDetail {
  id: string;
  slug: string;
  name: string;
  type: string;
  logoUrl: string | null;
  taxNumber: string | null;
  taxOffice: string | null;
  onboardingCompleted: boolean;
  createdAt: string;
  defaultCurrency: string;
  currencyPreferManualRates: boolean;
  currencyTcmbEnabled: boolean;
  currencyManualRates: Record<string, number> | null;
}
