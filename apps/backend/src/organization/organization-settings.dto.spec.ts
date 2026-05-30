import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { PatchOrganizationSettingsDto } from './organization-settings.dto';

function validateDto(
  input: Partial<PatchOrganizationSettingsDto>,
): ReturnType<typeof validateSync> {
  const dto = plainToInstance(PatchOrganizationSettingsDto, input);
  return validateSync(dto);
}

function messages(errors: ReturnType<typeof validateSync>): string[] {
  return errors.flatMap((e) => Object.values(e.constraints ?? {}));
}

describe('PatchOrganizationSettingsDto', () => {
  it('accepts empty prefix and valid sequence', () => {
    const errors = validateDto({ invoiceNumberPrefix: '', nextSequence: 1 });
    expect(errors).toHaveLength(0);
  });

  it('rejects prefix longer than 10 characters with Turkish message', () => {
    const errors = validateDto({ invoiceNumberPrefix: 'ABCDEFGHIJK' });
    expect(messages(errors)).toContain('Önek en fazla 10 karakter olabilir.');
  });

  it('rejects non-alphanumeric prefix with Turkish message', () => {
    const errors = validateDto({ invoiceNumberPrefix: 'FTR-1' });
    expect(messages(errors)).toContain('Önek yalnızca harf ve rakam içerebilir.');
  });

  it('rejects nextSequence below 1 with Turkish message', () => {
    const errors = validateDto({ nextSequence: 0 });
    expect(messages(errors)).toContain('Sıra numarası en az 1 olmalıdır.');
  });

  it('accepts defaultAutoInvoice boolean', () => {
    expect(validateDto({ defaultAutoInvoice: true })).toHaveLength(0);
    expect(validateDto({ defaultAutoInvoice: false })).toHaveLength(0);
  });

  it('rejects non-boolean defaultAutoInvoice', () => {
    const errors = validateDto({ defaultAutoInvoice: 'yes' as unknown as boolean });
    expect(messages(errors)).toContain('Otomatik fatura ayarı true veya false olmalıdır.');
  });

  it('accepts productMatchKey enum values', () => {
    expect(validateDto({ productMatchKey: 'BARCODE' })).toHaveLength(0);
    expect(validateDto({ productMatchKey: 'SKU' })).toHaveLength(0);
    expect(validateDto({ productMatchKey: 'MANUAL' })).toHaveLength(0);
  });

  it('rejects invalid productMatchKey', () => {
    const errors = validateDto({ productMatchKey: 'NAME' as 'BARCODE' });
    expect(messages(errors)).toContain('productMatchKey BARCODE, SKU veya MANUAL olmalıdır.');
  });
});
