import { AccountingMode, type Prisma } from '@prisma/client';

import type { ProductSelection } from './product-lines';

type PrismaOrgClient = {
  organization: {
    update: (args: {
      where: { id: string };
      data: { accountingMode: AccountingMode | null };
    }) => Promise<unknown>;
  };
  erpConnection: {
    count: (args: {
      where: {
        organizationId: string;
        deletedAt: null;
        isActive: boolean;
      };
    }) => Promise<number>;
  };
};

/**
 * Kayıt sırasında Organization.accountingMode:
 * ACCOUNTING → NATIVE; INTEGRATION / BUNDLE / seçimsiz → null (okuma anında ERP'ye göre çözülür).
 */
export function productSelectionToInitialAccountingMode(
  selection?: ProductSelection,
): AccountingMode | null {
  if (selection === 'ACCOUNTING') {
    return AccountingMode.NATIVE;
  }
  return null;
}

/** DB değeri yoksa aktif ERP sayısına göre mod döner */
export function resolveOrganizationAccountingMode(
  stored: AccountingMode | null,
  activeErpCount: number,
): AccountingMode {
  if (stored === AccountingMode.NATIVE || stored === AccountingMode.EXTERNAL_ERP) {
    return stored;
  }
  return activeErpCount > 0 ? AccountingMode.EXTERNAL_ERP : AccountingMode.NATIVE;
}

/** Aktif ERP bağlantısı varken EXTERNAL_ERP, yoksa NATIVE yazar */
export async function syncOrganizationAccountingModeFromErp(
  prisma: PrismaOrgClient,
  organizationId: string,
): Promise<void> {
  const activeCount = await prisma.erpConnection.count({
    where: { organizationId, deletedAt: null, isActive: true },
  });
  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      accountingMode:
        activeCount > 0 ? AccountingMode.EXTERNAL_ERP : AccountingMode.NATIVE,
    },
  });
}

/** Yeni veya yeniden etkinleştirilen ERP bağlantısı sonrası */
export async function setOrganizationAccountingModeExternal(
  prisma: PrismaOrgClient,
  organizationId: string,
): Promise<void> {
  await prisma.organization.update({
    where: { id: organizationId },
    data: { accountingMode: AccountingMode.EXTERNAL_ERP },
  });
}

export type { Prisma };
