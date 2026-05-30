export interface AuthUserDto {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: string;
  organizationId: string | null;
  twoFactorEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export type OrgPlanTier = 'BASLANGIC' | 'GELISIM' | 'PRO' | 'KURUMSAL';

export type OrgType = 'DIRECT' | 'PARTNER';

/** Organizasyonun aktif ürün hatları (BUNDLE = her ikisi) */
export type OrgProductLine = 'INTEGRATION' | 'ACCOUNTING';

export interface AuthOrganizationSecurityDto {
  requiresTwoFactorSetup?: boolean;
  passwordChangeRequired?: boolean;
  passwordChangeWarning?: boolean;
}

/** Yerel ön muhasebe veya harici ERP — backend sağlarsa öncelikli */
export type AccountingMode = 'NATIVE' | 'EXTERNAL_ERP';

export interface AuthOrganizationDto {
  id: string;
  slug: string;
  name: string;
  type: OrgType;
  logoUrl: string | null;
  createdAt: string;
  onboardingCompleted: boolean;
  plan: OrgPlanTier;
  internalAccount?: boolean;
  billingExempt?: boolean;
  orgProducts: OrgProductLine[];
  /** /me — çözümlenmiş ürün hatları (orgProducts ile aynı) */
  productLines: OrgProductLine[];
  /** /me — DB + aktif ERP sayısına göre çözülmüş mod */
  accountingMode: AccountingMode;
  security?: AuthOrganizationSecurityDto;
}

export interface MeResponse {
  user: AuthUserDto;
  organization: AuthOrganizationDto;
  currentOrgId: string;
  isImpersonating: boolean;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  sessionId?: string;
}

export type LoginResponse =
  | TokenPair
  | { requiresTwoFactor: true; tempToken: string };
