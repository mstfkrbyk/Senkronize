import { Organization, User } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  orgId: string;
  role: string;
  impersonatedOrgId?: string;
}

/** JWT ile doğrulanmış panel kullanıcısı — her zaman org bağlıdır */
export type AuthenticatedUser = Omit<User, 'organization' | 'organizationId'> & {
  organizationId: string;
  organization: Organization;
  currentOrgId: string;
  isImpersonating: boolean;
};
