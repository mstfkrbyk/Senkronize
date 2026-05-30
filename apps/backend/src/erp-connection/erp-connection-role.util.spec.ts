import { ErpConnectionRole } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';

import {
  resolveRoleForNewConnection,
  assertSecondaryErpWriteFlags,
} from './erp-connection-role.util';

describe('erp-connection-role.util', () => {
  it('assigns PRIMARY when no primary exists', () => {
    expect(resolveRoleForNewConnection(false)).toBe(ErpConnectionRole.PRIMARY);
  });

  it('assigns SECONDARY when primary exists', () => {
    expect(resolveRoleForNewConnection(true)).toBe(ErpConnectionRole.SECONDARY);
  });

  it('rejects second PRIMARY', () => {
    expect(() =>
      resolveRoleForNewConnection(true, ErpConnectionRole.PRIMARY),
    ).toThrow(BadRequestException);
  });

  it('blocks invoice flags on secondary', () => {
    expect(() =>
      assertSecondaryErpWriteFlags({ syncInvoices: true }),
    ).toThrow(BadRequestException);
  });
});
