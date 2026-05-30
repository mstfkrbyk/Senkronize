import type { Prisma } from '@prisma/client';

import { upsertErpStockAndMergeCentral } from './erp-stock-merge.util';

describe('upsertErpStockAndMergeCentral', () => {
  const orgId = 'org-1';
  const warehouseId = 'wh-main';
  const barcode = '869000000001';

  function createTx(initial: {
    erpEntries?: Array<{
      id: string;
      erpConnectionId: string;
      quantity: number;
    }>;
    central?: { id: string; quantity: number } | null;
  }) {
    const erpEntries = [...(initial.erpEntries ?? [])];
    let central = initial.central ?? null;

    const tx = {
      erpStockEntry: {
        findFirst: jest.fn(async ({ where }: { where: Record<string, string> }) =>
          erpEntries.find(
            (row) =>
              row.erpConnectionId === where.erpConnectionId &&
              row.id.startsWith('erp-'),
          ) ??
          erpEntries.find((row) => row.erpConnectionId === where.erpConnectionId) ??
          null,
        ),
        update: jest.fn(async ({ where, data }: { where: { id: string }; data: { quantity: number } }) => {
          const idx = erpEntries.findIndex((row) => row.id === where.id);
          if (idx >= 0) {
            erpEntries[idx] = { ...erpEntries[idx], quantity: data.quantity };
          }
        }),
        create: jest.fn(async ({ data }: { data: { erpConnectionId: string; quantity: number } }) => {
          erpEntries.push({
            id: `erp-${erpEntries.length + 1}`,
            erpConnectionId: data.erpConnectionId,
            quantity: data.quantity,
          });
        }),
        aggregate: jest.fn(async () => ({
          _sum: { quantity: erpEntries.reduce((sum, row) => sum + row.quantity, 0) },
        })),
      },
      stockEntry: {
        findFirst: jest.fn(async () => central),
        update: jest.fn(async ({ data }: { data: { quantity: number } }) => {
          if (central) {
            central = { ...central, quantity: data.quantity };
          }
        }),
        create: jest.fn(async ({ data }: { data: { quantity: number } }) => {
          central = { id: 'central-1', quantity: data.quantity };
        }),
      },
    };

    return {
      tx: tx as unknown as Prisma.TransactionClient,
      getMergedCentral: () => central?.quantity ?? 0,
      getErpTotal: () => erpEntries.reduce((sum, row) => sum + row.quantity, 0),
    };
  }

  it('merges stock from two ERP connections into central total', async () => {
    const erpA = 'conn-a';
    const erpB = 'conn-b';
    const first = createTx({ central: null });

    await upsertErpStockAndMergeCentral(first.tx, {
      organizationId: orgId,
      erpConnectionId: erpA,
      warehouseId,
      barcode,
      quantity: 10,
      productId: 'prod-1',
    });
    expect(first.getMergedCentral()).toBe(10);

    const second = createTx({
      erpEntries: [{ id: 'erp-1', erpConnectionId: erpA, quantity: 10 }],
      central: { id: 'central-1', quantity: 10 },
    });

    await upsertErpStockAndMergeCentral(second.tx, {
      organizationId: orgId,
      erpConnectionId: erpB,
      warehouseId,
      barcode,
      quantity: 7,
      productId: 'prod-1',
    });

    expect(second.getMergedCentral()).toBe(17);
  });
});
