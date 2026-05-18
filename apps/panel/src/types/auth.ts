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

export interface AuthOrganizationDto {
  id: string;
  slug: string;
  name: string;
  type: OrgType;
  logoUrl: string | null;
  createdAt: string;
  onboardingCompleted: boolean;
  plan: OrgPlanTier;
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
