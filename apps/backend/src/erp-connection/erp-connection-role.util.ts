import { BadRequestException } from '@nestjs/common';
import { ErpConnectionRole } from '@prisma/client';

/** İkincil ERP: stok/ürün okuma; fatura ve ERP'ye yazma kapalı */
export const SECONDARY_ERP_SYNC_DEFAULTS = {
  syncStock: true,
  syncProducts: true,
  syncPrices: false,
  syncInvoices: false,
  syncCustomers: false,
  autoCreateInvoice: false,
} as const;

export function assertSecondaryErpWriteFlags(flags: {
  syncInvoices?: boolean;
  autoCreateInvoice?: boolean;
}): void {
  if (flags.syncInvoices === true || flags.autoCreateInvoice === true) {
    throw new BadRequestException(
      'İkincil ERP bağlantısında fatura senkronu ve otomatik fatura açılamaz.',
    );
  }
}

export function resolveRoleForNewConnection(
  activePrimaryExists: boolean,
  requestedRole?: ErpConnectionRole,
): ErpConnectionRole {
  if (requestedRole === ErpConnectionRole.PRIMARY) {
    if (activePrimaryExists) {
      throw new BadRequestException(
        'Organizasyonda zaten bir birincil ERP var. Önce mevcut birincili değiştirin.',
      );
    }
    return ErpConnectionRole.PRIMARY;
  }
  if (requestedRole === ErpConnectionRole.SECONDARY) {
    return ErpConnectionRole.SECONDARY;
  }
  return activePrimaryExists
    ? ErpConnectionRole.SECONDARY
    : ErpConnectionRole.PRIMARY;
}
