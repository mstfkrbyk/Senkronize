import { OrgType } from '@prisma/client';

import type { RegisterDto } from '../../src/auth/auth.dto';

/**
 * Kayıt DTO’su için tutarlı test verisi (unit / e2e body).
 */
export function buildRegisterDto(
  overrides: Partial<RegisterDto> = {},
): RegisterDto {
  const suffix = Date.now().toString().slice(-6);
  return {
    email: `user-${suffix}@senkronize.test`,
    password: 'TestPassword123!',
    name: 'Test User',
    phone: '+905551112233',
    companyName: 'Test Company',
    taxNumber: `1234${suffix}`.slice(0, 10),
    taxOffice: 'Kadıköy',
    address: 'Test adres 1',
    city: 'İstanbul',
    orgType: OrgType.DIRECT,
    ...overrides,
  };
}

export function uniqueTaxNumber(): string {
  return `9${Date.now().toString().slice(-9)}`.padStart(10, '0').slice(0, 10);
}
