import { AccountingMode } from '@prisma/client';

import {
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
