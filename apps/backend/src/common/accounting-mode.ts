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

const ACTIVE_ERP_CONNECTION_WHERE = {
  deletedAt: null,
  isActive: true,
} as const;

/** Admin org listesi — çözümlenen muhasebe moduna göre Prisma where */
export function organizationWhereResolvedAccountingMode(
  mode: AccountingMode,
): Prisma.OrganizationWhereInput {
  if (mode === AccountingMode.NATIVE) {
    return {
      OR: [
        { accountingMode: AccountingMode.NATIVE },
        {
          accountingMode: null,
          erpConnections: { none: ACTIVE_ERP_CONNECTION_WHERE },
        },
      ],
    };
  }
  return {
    OR: [
      { accountingMode: AccountingMode.EXTERNAL_ERP },
      {
        accountingMode: null,
        erpConnections: { some: ACTIVE_ERP_CONNECTION_WHERE },
      },
    ],
  };
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

/** NATIVE moda geçişte aktif ERP varken dönen Türkçe mesaj */
export const ACCOUNTING_MODE_NATIVE_BLOCKED_MESSAGE =
  'Aktif harici ERP bağlantısı varken yerel ön muhasebe moduna geçilemez. Önce tüm ERP bağlantılarını devre dışı bırakın veya kaldırın.';

/** Organizasyon PATCH ile mod değişiminin izinli olup olmadığı */
export function getAccountingModeChangeBlockReason(
  target: AccountingMode,
  activeErpCount: number,
): string | null {
  if (target === AccountingMode.NATIVE && activeErpCount > 0) {
    return ACCOUNTING_MODE_NATIVE_BLOCKED_MESSAGE;
  }
  return null;
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
