import { OrgType, type Prisma } from '@prisma/client';

/** Platform (super-admin) org — müşteri metriklerinden hariç. */
export const PLATFORM_ORG_SLUG = 'senkronize-platform';

/** Admin müşteri listesi / metrikleri: yalnızca doğrudan müşteri org'ları. */
export const CUSTOMER_ORG_WHERE: Prisma.OrganizationWhereInput = {
  deletedAt: null,
  type: OrgType.DIRECT,
  slug: { not: PLATFORM_ORG_SLUG },
};

export function customerOrgWhere(
  extra?: Prisma.OrganizationWhereInput,
): Prisma.OrganizationWhereInput {
  if (!extra) {
    return CUSTOMER_ORG_WHERE;
  }
  return { AND: [CUSTOMER_ORG_WHERE, extra] };
}
