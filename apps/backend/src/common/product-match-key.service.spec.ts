import { ProductMatchKey } from '@prisma/client';

import { ProductMatchKeyService } from './product-match-key.service';
import { resolveProductMatchKey } from '../organization/organization.types';

describe('ProductMatchKeyService', () => {
  const prisma = {
    organization: { findFirst: jest.fn() },
    erpConnection: { findFirst: jest.fn() },
    marketplaceConnection: { findMany: jest.fn(), findFirst: jest.fn() },
  };
  const service = new ProductMatchKeyService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads org match key from metadata', async () => {
    prisma.organization.findFirst.mockResolvedValue({
      metadata: { productMatchKey: 'SKU' },
    });
    await expect(service.loadOrgMatchKey('org-1')).resolves.toBe('SKU');
  });

  it('resolves erp connection with overrides', async () => {
    prisma.organization.findFirst.mockResolvedValue({
      metadata: { productMatchKey: 'BARCODE' },
    });
    prisma.erpConnection.findFirst.mockResolvedValue({
      productMatchKey: ProductMatchKey.SKU,
    });
    await expect(
      service.resolveForErpConnection('org-1', 'conn-1'),
    ).resolves.toBe('SKU');
    await expect(
      service.resolveForErpConnection('org-1', 'conn-1', ProductMatchKey.MANUAL),
    ).resolves.toBe('MANUAL');
  });

  it('returns null when org key missing', async () => {
    prisma.organization.findFirst.mockResolvedValue({ metadata: {} });
    prisma.erpConnection.findFirst.mockResolvedValue({ productMatchKey: null });
    await expect(
      service.resolveForErpConnection('org-1', 'conn-1'),
    ).resolves.toBeNull();
    expect(resolveProductMatchKey({})).toBeNull();
  });
});
