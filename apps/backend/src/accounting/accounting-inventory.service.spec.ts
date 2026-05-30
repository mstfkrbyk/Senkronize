import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../prisma/prisma.service';

import { AccountingInventoryService } from './accounting-inventory.service';

describe('AccountingInventoryService', () => {
  let service: AccountingInventoryService;
  let prisma: {
    warehouse: { findFirst: jest.Mock };
    stockEntry: { findMany: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      warehouse: { findFirst: jest.fn() },
      stockEntry: { findMany: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountingInventoryService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(AccountingInventoryService);
  });

  it('getInventoryValuation — qty × costPrice toplar (tüm depolar)', async () => {
    prisma.stockEntry.findMany.mockResolvedValue([
      {
        quantity: 10,
        barcode: '8690000001',
        product: { costPrice: new Prisma.Decimal('25.5') },
      },
      {
        quantity: 4,
        barcode: '8690000002',
        product: { costPrice: new Prisma.Decimal('100') },
      },
      {
        quantity: 0,
        barcode: '8690000003',
        product: { costPrice: new Prisma.Decimal('50') },
      },
      {
        quantity: 2,
        barcode: '8690000004',
        product: null,
      },
    ]);

    const result = await service.getInventoryValuation('org-1');

    expect(result).toEqual({
      warehouseId: null,
      totalQuantity: 16,
      totalValue: '655.00',
      skuCount: 3,
      currency: 'TRY',
    });
    expect(prisma.stockEntry.findMany).toHaveBeenCalledWith({
      where: { organizationId: 'org-1' },
      select: expect.any(Object),
    });
    expect(prisma.warehouse.findFirst).not.toHaveBeenCalled();
  });

  it('getInventoryValuation — warehouseId ile depo filtresi uygular', async () => {
    prisma.warehouse.findFirst.mockResolvedValue({ id: 'wh-1' });
    prisma.stockEntry.findMany.mockResolvedValue([
      {
        quantity: 3,
        barcode: '8690000001',
        product: { costPrice: new Prisma.Decimal('10') },
      },
    ]);

    const result = await service.getInventoryValuation('org-1', 'wh-1');

    expect(result.warehouseId).toBe('wh-1');
    expect(result.totalValue).toBe('30.00');
    expect(prisma.warehouse.findFirst).toHaveBeenCalledWith({
      where: { id: 'wh-1', organizationId: 'org-1' },
      select: { id: true },
    });
    expect(prisma.stockEntry.findMany).toHaveBeenCalledWith({
      where: { organizationId: 'org-1', warehouseId: 'wh-1' },
      select: expect.any(Object),
    });
  });

  it('getInventoryValuation — depo bulunamazsa NotFoundException', async () => {
    prisma.warehouse.findFirst.mockResolvedValue(null);

    await expect(
      service.getInventoryValuation('org-1', 'wh-missing'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.stockEntry.findMany).not.toHaveBeenCalled();
  });
});
