import { Organization, User } from '@prisma/client';

export type AuthenticatedUser = User & {
  organization: Organization;
  currentOrgId: string;
  isImpersonating: boolean;
};
