import { Organization, User } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  orgId: string;
  role: string;
  impersonatedOrgId?: string;
}

export type AuthenticatedUser = User & {
  organization: Organization;
  currentOrgId: string;
  isImpersonating: boolean;
};
