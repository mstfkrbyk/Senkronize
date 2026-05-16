export interface AuthUserDto {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: string;
  organizationId: string;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface AuthOrganizationDto {
  id: string;
  slug: string;
  name: string;
  type: string;
  logoUrl: string | null;
  createdAt: string;
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
}
