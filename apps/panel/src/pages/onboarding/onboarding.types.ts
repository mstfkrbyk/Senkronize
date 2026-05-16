export interface OnboardingState {
  currentStep: number;
  orgName: string;
  selectedMarketplace: string | null;
  marketplaceCredentials: Record<string, string>;
  selectedErp: string | null;
  erpCredentials: Record<string, string>;
}

export type MarketplaceOption = {
  id: string;
  label: string;
  logo: string;
  fields: CredentialField[];
};

export type ErpOption = {
  id: string;
  label: string;
  logo: string;
  fields: CredentialField[];
};

export type CredentialField = {
  key: string;
  label: string;
  type: 'text' | 'password';
  placeholder?: string;
  required: boolean;
};
