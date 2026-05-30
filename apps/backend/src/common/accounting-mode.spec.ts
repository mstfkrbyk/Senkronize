import { AccountingMode } from '@prisma/client';

import {
  ACCOUNTING_MODE_NATIVE_BLOCKED_MESSAGE,
  getAccountingModeChangeBlockReason,
  organizationWhereResolvedAccountingMode,
  productSelectionToInitialAccountingMode,
  resolveOrganizationAccountingMode,
} from './accounting-mode';

describe('productSelectionToInitialAccountingMode', () => {
  it('ACCOUNTING seçiminde NATIVE döner', () => {
    expect(productSelectionToInitialAccountingMode('ACCOUNTING')).toBe(
      AccountingMode.NATIVE,
    );
  });

  it('INTEGRATION veya seçimsiz kayıtta null döner', () => {
    expect(productSelectionToInitialAccountingMode('INTEGRATION')).toBeNull();
    expect(productSelectionToInitialAccountingMode()).toBeNull();
    expect(productSelectionToInitialAccountingMode('BUNDLE')).toBeNull();
  });
});

describe('resolveOrganizationAccountingMode', () => {
  it('saklanan mod varsa doğrudan döner', () => {
    expect(
      resolveOrganizationAccountingMode(AccountingMode.NATIVE, 3),
    ).toBe(AccountingMode.NATIVE);
    expect(
      resolveOrganizationAccountingMode(AccountingMode.EXTERNAL_ERP, 0),
    ).toBe(AccountingMode.EXTERNAL_ERP);
  });

  it('null modda aktif ERP sayısına göre çözümler', () => {
    expect(resolveOrganizationAccountingMode(null, 0)).toBe(
      AccountingMode.NATIVE,
    );
    expect(resolveOrganizationAccountingMode(null, 2)).toBe(
      AccountingMode.EXTERNAL_ERP,
    );
  });
});

describe('organizationWhereResolvedAccountingMode', () => {
  it('NATIVE: saklanan NATIVE veya null + aktif ERP yok', () => {
    expect(organizationWhereResolvedAccountingMode(AccountingMode.NATIVE)).toEqual({
      OR: [
        { accountingMode: AccountingMode.NATIVE },
        {
          accountingMode: null,
          erpConnections: { none: { deletedAt: null, isActive: true } },
        },
      ],
    });
  });

  it('EXTERNAL_ERP: saklanan EXTERNAL_ERP veya null + aktif ERP var', () => {
    expect(
      organizationWhereResolvedAccountingMode(AccountingMode.EXTERNAL_ERP),
    ).toEqual({
      OR: [
        { accountingMode: AccountingMode.EXTERNAL_ERP },
        {
          accountingMode: null,
          erpConnections: { some: { deletedAt: null, isActive: true } },
        },
      ],
    });
  });
});

describe('getAccountingModeChangeBlockReason', () => {
  it('aktif ERP varken NATIVE engellenir', () => {
    expect(
      getAccountingModeChangeBlockReason(AccountingMode.NATIVE, 1),
    ).toBe(ACCOUNTING_MODE_NATIVE_BLOCKED_MESSAGE);
  });

  it('aktif ERP yokken NATIVE serbest', () => {
    expect(getAccountingModeChangeBlockReason(AccountingMode.NATIVE, 0)).toBeNull();
  });

  it('EXTERNAL_ERP her zaman serbest', () => {
    expect(
      getAccountingModeChangeBlockReason(AccountingMode.EXTERNAL_ERP, 3),
    ).toBeNull();
  });
});
