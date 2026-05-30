import { ErpProductReconcileService } from './erp-product-reconcile.service';

describe('ErpProductReconcileService', () => {
  const organizationId = 'org-1';
  const erpConnectionId = 'erp-secondary';
  const mainWh = { id: 'wh-main' };

  function createService(deps: {
    erpStockRows?: Array<{ id: string; barcode: string; productId: string | null }>;
    products?: Array<{
      id: string;
      barcode: string | null;
      sku: string | null;
      sourceErpConnectionId: string | null;
      listings: Array<{ id: string }>;
      erpStockEntries: Array<{ erpConnectionId: string }>;
    }>;
    connectionRole?: 'PRIMARY' | 'SECONDARY';
    primaryIds?: string[];
  }) {
    const prisma = {
      erpConnection: {
        findFirst: jest.fn(async () =>
          deps.connectionRole ? { role: deps.connectionRole } : null,
        ),
        findMany: jest.fn(async () =>
          (deps.primaryIds ?? []).map((id) => ({ id })),
        ),
      },
      erpStockEntry: {
        findMany: jest.fn(async () => deps.erpStockRows ?? []),
      },
      product: {
        findMany: jest.fn(async (args?: { where?: { sourceErpConnectionId?: unknown } }) => {
          const rows = deps.products ?? [];
          if (args?.where && 'sourceErpConnectionId' in args.where) {
            const source = args.where.sourceErpConnectionId;
            if (source === null) {
              return rows.filter((row) => row.sourceErpConnectionId === null);
            }
          }
          return rows;
        }),
        update: jest.fn(async () => ({})),
      },
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          erpStockEntry: {
            deleteMany: jest.fn(async () => ({ count: 1 })),
            aggregate: jest.fn(async () => ({ _sum: { quantity: 0 } })),
          },
          stockEntry: {
            findFirst: jest.fn(async () => null),
          },
        }),
      ),
    };
    const warehouseService = {
      getOrCreateMainWarehouse: jest.fn(async () => mainWh),
    };
    return {
      service: new ErpProductReconcileService(
        prisma as never,
        warehouseService as never,
      ),
      prisma,
    };
  }

  it('soft-deletes products sourced from ERP that fall outside import filter', async () => {
    const { service, prisma } = createService({
      connectionRole: 'SECONDARY',
      erpStockRows: [{ id: 'es-1', barcode: 'STALE', productId: 'p-stale' }],
      products: [
        {
          id: 'p-stale',
          barcode: 'STALE',
          sku: null,
          sourceErpConnectionId: erpConnectionId,
          listings: [],
          erpStockEntries: [{ erpConnectionId }],
        },
        {
          id: 'p-keep',
          barcode: 'KEEP',
          sku: null,
          sourceErpConnectionId: erpConnectionId,
          listings: [],
          erpStockEntries: [{ erpConnectionId }],
        },
      ],
    });

    const result = await service.reconcileAfterImport(
      organizationId,
      erpConnectionId,
      new Set(['KEEP']),
    );

    expect(result.removedProducts).toBe(1);
    expect(prisma.product.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'p-stale' } }),
    );
  });
});
