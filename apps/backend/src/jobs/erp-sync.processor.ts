import { InjectQueue, Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import {
  ErpType,
  NotificationType,
  OrderStatus,
  Prisma,
  StockMovementType,
} from '@prisma/client';
import type { ErpInvoice, IErpAdapter } from '@senkronize/shared';
import type { Job, Queue } from 'bull';

import { AdapterRegistry } from '../adapters/adapter.registry';
import { ErpConnectionService } from '../erp-connection/erp-connection.service';
import { ErpSyncSettingsService } from '../erp/erp-sync-settings.service';
import { InAppNotificationService } from '../notifications/in-app/in-app-notification.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  LISTING_SYNC_STOCK_JOB_OPTIONS,
  QUEUE_ERP_SYNC,
  QUEUE_LISTING_SYNC,
} from '../queue/queue.constants';
import type { ErpSyncJobData, ListingSyncStockJobData } from '../queue/queue.types';
import { SyncLogService } from '../sync/sync-log.service';
import { WarehouseService } from '../warehouse/warehouse.service';

import {
  buildErpProductMap,
  isErpStockCapableAdapter,
  toDecimal,
} from './erp-sync.helpers';

@Processor(QUEUE_ERP_SYNC)
export class ErpSyncProcessor {
  private readonly logger = new Logger(ErpSyncProcessor.name);

  constructor(
    private readonly adapterRegistry: AdapterRegistry,
    private readonly erpConnectionService: ErpConnectionService,
    private readonly erpSyncSettingsService: ErpSyncSettingsService,
    private readonly syncLogService: SyncLogService,
    private readonly prisma: PrismaService,
    private readonly warehouseService: WarehouseService,
    private readonly inAppNotificationService: InAppNotificationService,
    @InjectQueue(QUEUE_LISTING_SYNC)
    private readonly listingSyncQueue: Queue<ListingSyncStockJobData>,
  ) {}

  @Process('sync-products')
  async handleSyncProducts(job: Job<ErpSyncJobData>): Promise<void> {
    await this.runSyncJob(job, 'products', async (adapter, credentials, ctx) => {
      const erpProducts = await adapter.getProducts(credentials);
      const mainWh = await this.warehouseService.getOrCreateMainWarehouse(
        ctx.organizationId,
      );
      let processed = 0;
      let failed = 0;

      for (const erpProduct of erpProducts) {
        const barcode = erpProduct.barcode.trim();
        if (barcode.length === 0) {
          failed += 1;
          continue;
        }
        try {
          const priorStock = await this.prisma.stockEntry.findFirst({
            where: {
              organizationId: ctx.organizationId,
              barcode,
              platform: null,
              warehouseId: mainWh.id,
            },
            select: { quantity: true },
          });
          const beforeQty = priorStock?.quantity ?? 0;
          const afterQty = erpProduct.stockQuantity;

          await this.prisma.$transaction(async (tx) => {
            const existing = await tx.product.findFirst({
              where: {
                organizationId: ctx.organizationId,
                barcode,
                deletedAt: null,
              },
            });
            const costPrice = toDecimal(erpProduct.purchasePrice);
            if (existing) {
              await tx.product.update({
                where: { id: existing.id },
                data: {
                  name: erpProduct.name,
                  ...(costPrice !== undefined ? { costPrice } : {}),
                },
              });
            } else {
              await tx.product.create({
                data: {
                  organizationId: ctx.organizationId,
                  barcode,
                  name: erpProduct.name,
                  sku: barcode,
                  ...(costPrice !== undefined ? { costPrice } : {}),
                },
              });
            }

            const product = await tx.product.findFirst({
              where: {
                organizationId: ctx.organizationId,
                barcode,
                deletedAt: null,
              },
              select: { id: true },
            });

            const stockRow = await tx.stockEntry.findFirst({
              where: {
                organizationId: ctx.organizationId,
                barcode,
                platform: null,
                warehouseId: mainWh.id,
              },
            });
            if (stockRow) {
              await tx.stockEntry.update({
                where: { id: stockRow.id },
                data: {
                  quantity: afterQty,
                  ...(product ? { productId: product.id } : {}),
                },
              });
            } else {
              await tx.stockEntry.create({
                data: {
                  organizationId: ctx.organizationId,
                  warehouseId: mainWh.id,
                  barcode,
                  platform: null,
                  quantity: afterQty,
                  productId: product?.id ?? null,
                },
              });
            }
            if (beforeQty !== afterQty) {
              await tx.stockMovement.create({
                data: {
                  organizationId: ctx.organizationId,
                  barcode,
                  warehouseId: mainWh.id,
                  platform: null,
                  movementType: StockMovementType.ADJUSTMENT,
                  quantity: afterQty - beforeQty,
                  beforeQuantity: beforeQty,
                  afterQuantity: afterQty,
                  note: 'ERP ürün senkronu',
                },
              });
            }
          });
          if (beforeQty !== afterQty) {
            await this.enqueueListingStockSync(ctx.organizationId, barcode, afterQty);
          }
          processed += 1;
        } catch (error) {
          failed += 1;
          this.logger.warn('ERP ürün senkronu başarısız', {
            organizationId: ctx.organizationId,
            barcode,
            error: error instanceof Error ? error.message : 'Bilinmeyen hata',
          });
        }
      }

      return { processed, failed };
    });
  }

  @Process('sync-customers')
  async handleSyncCustomers(job: Job<ErpSyncJobData>): Promise<void> {
    await this.runSyncJob(job, 'customers', async () => ({
      processed: 0,
      failed: 0,
    }));
  }

  @Process('sync-stock')
  async handleSyncStock(job: Job<ErpSyncJobData>): Promise<void> {
    await this.runSyncJob(job, 'stock', async (adapter, credentials, ctx) => {
      if (job.data.direction === 'push' && job.data.barcode && job.data.quantity !== undefined) {
        return this.pushStockToErp(
          adapter,
          credentials,
          ctx.organizationId,
          job.data.barcode,
          job.data.quantity,
        );
      }
      return this.pullStockFromErp(adapter, credentials, ctx.organizationId);
    });
  }

  @Process('sync-invoices')
  async handleSyncInvoices(job: Job<ErpSyncJobData>): Promise<void> {
    await this.runSyncJob(job, 'invoices', async (adapter, credentials, ctx) => {
      const orders = await this.prisma.order.findMany({
        where: {
          organizationId: ctx.organizationId,
          status: OrderStatus.DELIVERED,
          deletedAt: null,
          autoInvoice: true,
        },
        include: { items: true },
        orderBy: { updatedAt: 'desc' },
        take: 100,
      });

      let processed = 0;
      let failed = 0;

      for (const order of orders) {
        const alreadySynced = await this.prisma.auditLog.findFirst({
          where: {
            actorOrgId: ctx.organizationId,
            action: 'erp.invoice_created',
            resourceType: 'Order',
            resourceId: order.id,
          },
          select: { id: true },
        });
        if (alreadySynced) {
          continue;
        }

        try {
          const invoice = await this.createErpInvoiceFromOrder(
            adapter,
            credentials,
            order,
          );
          await this.prisma.auditLog.create({
            data: {
              actorUserId: 'system',
              actorOrgId: ctx.organizationId,
              action: 'erp.invoice_created',
              resourceType: 'Order',
              resourceId: order.id,
              metadata: {
                invoiceNo: invoice.invoiceNumber,
                erpConnectionId: ctx.erpConnectionId,
                erpType: ctx.erpType,
                source: 'erp-sync',
              },
            },
          });
          processed += 1;
        } catch (error) {
          failed += 1;
          const message = error instanceof Error ? error.message : 'Bilinmeyen hata';
          this.logger.warn('ERP fatura senkronu başarısız', {
            organizationId: ctx.organizationId,
            orderId: order.id,
            error: message,
          });
          await this.notifyErpInvoiceFailure(ctx.organizationId, order.id, message, ctx.erpType);
        }
      }

      return { processed, failed };
    });
  }

  @Process('push-order-invoice')
  async handlePushOrderInvoice(job: Job<ErpSyncJobData>): Promise<void> {
    const orderId = job.data.orderId;
    if (!orderId) {
      return;
    }
    await this.runSyncJob(job, 'invoices', async (adapter, credentials, ctx) => {
      const order = await this.prisma.order.findFirst({
        where: {
          id: orderId,
          organizationId: ctx.organizationId,
          deletedAt: null,
        },
        include: { items: true },
      });
      if (!order) {
        return { processed: 0, failed: 0 };
      }

      const alreadySynced = await this.prisma.auditLog.findFirst({
        where: {
          actorOrgId: ctx.organizationId,
          action: 'erp.invoice_created',
          resourceType: 'Order',
          resourceId: order.id,
        },
        select: { id: true },
      });
      if (alreadySynced) {
        return { processed: 0, failed: 0 };
      }

      try {
        const invoice = await this.createErpInvoiceFromOrder(
          adapter,
          credentials,
          order,
        );
        await this.prisma.auditLog.create({
          data: {
            actorUserId: 'system',
            actorOrgId: ctx.organizationId,
            action: 'erp.invoice_created',
            resourceType: 'Order',
            resourceId: order.id,
            metadata: {
              invoiceNo: invoice.invoiceNumber,
              erpConnectionId: ctx.erpConnectionId,
              erpType: ctx.erpType,
              source: 'order-delivered',
            },
          },
        });
        return { processed: 1, failed: 0 };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Bilinmeyen hata';
        this.logger.warn('Sipariş ERP faturası oluşturulamadı', {
          organizationId: ctx.organizationId,
          orderId,
          error: message,
        });
        await this.notifyErpInvoiceFailure(ctx.organizationId, orderId, message, ctx.erpType);
        return { processed: 0, failed: 1 };
      }
    });
  }

  @Process('push-stock-to-erp')
  async handlePushStockToErp(job: Job<ErpSyncJobData>): Promise<void> {
    const barcode = job.data.barcode?.trim();
    const quantity = job.data.quantity;
    if (!barcode || quantity === undefined) {
      return;
    }
    await this.runSyncJob(job, 'stock', async (adapter, credentials, ctx) => {
      return this.pushStockToErp(
        adapter,
        credentials,
        ctx.organizationId,
        barcode,
        quantity,
      );
    });
  }

  private async pullStockFromErp(
    adapter: IErpAdapter,
    credentials: Record<string, string>,
    organizationId: string,
  ): Promise<{ processed: number; failed: number }> {
    const erpProducts = await adapter.getProducts(credentials);
    const mainWh = await this.warehouseService.getOrCreateMainWarehouse(organizationId);
    let processed = 0;
    let failed = 0;

    for (const erpProduct of erpProducts) {
      const barcode = erpProduct.barcode.trim();
      if (barcode.length === 0) {
        failed += 1;
        continue;
      }
        try {
          const priorStock = await this.prisma.stockEntry.findFirst({
            where: {
              organizationId,
              barcode,
              platform: null,
              warehouseId: mainWh.id,
            },
            select: { quantity: true },
          });
          const beforeQty = priorStock?.quantity ?? 0;
          const afterQty = erpProduct.stockQuantity;

          await this.prisma.$transaction(async (tx) => {
            const product = await tx.product.findFirst({
              where: { organizationId, barcode, deletedAt: null },
              select: { id: true },
            });
            const stockRow = await tx.stockEntry.findFirst({
              where: {
                organizationId,
                barcode,
                platform: null,
                warehouseId: mainWh.id,
              },
            });
            if (stockRow) {
              await tx.stockEntry.update({
                where: { id: stockRow.id },
                data: {
                  quantity: afterQty,
                  ...(product ? { productId: product.id } : {}),
                },
              });
            } else {
              await tx.stockEntry.create({
                data: {
                  organizationId,
                  warehouseId: mainWh.id,
                  barcode,
                  platform: null,
                  quantity: afterQty,
                  productId: product?.id ?? null,
                },
              });
            }
            if (beforeQty !== afterQty) {
              await tx.stockMovement.create({
                data: {
                  organizationId,
                  barcode,
                  warehouseId: mainWh.id,
                  platform: null,
                  movementType: StockMovementType.ADJUSTMENT,
                  quantity: afterQty - beforeQty,
                  beforeQuantity: beforeQty,
                  afterQuantity: afterQty,
                  note: 'ERP stok senkronu',
                },
              });
            }
          });
          if (beforeQty !== afterQty) {
            await this.enqueueListingStockSync(organizationId, barcode, afterQty);
          }
          processed += 1;
      } catch (error) {
        failed += 1;
        this.logger.warn('ERP stok çekme başarısız', {
          organizationId,
          barcode,
          error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        });
      }
    }

    return { processed, failed };
  }

  private async pushStockToErp(
    adapter: IErpAdapter,
    credentials: Record<string, string>,
    organizationId: string,
    barcode: string,
    quantity: number,
  ): Promise<{ processed: number; failed: number }> {
    if (!isErpStockCapableAdapter(adapter)) {
      this.logger.warn('ERP adaptörü stok push desteklemiyor', {
        organizationId,
        erpType: adapter.erpType,
      });
      return { processed: 0, failed: 1 };
    }

    const erpProducts = await adapter.getProducts(credentials);
    const productMap = buildErpProductMap(erpProducts);
    const erpProduct = productMap.get(barcode);
    if (!erpProduct) {
      this.logger.warn('ERP ürün eşleşmesi bulunamadı', { organizationId, barcode });
      return { processed: 0, failed: 1 };
    }

    try {
      await adapter.updateStock(
        credentials,
        erpProduct.erpProductId,
        quantity,
        'Senkronize',
      );
      return { processed: 1, failed: 0 };
    } catch (error) {
      this.logger.warn('ERP stok push başarısız', {
        organizationId,
        barcode,
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      });
      return { processed: 0, failed: 1 };
    }
  }

  private async createErpInvoiceFromOrder(
    adapter: IErpAdapter,
    credentials: Record<string, string>,
    order: Prisma.OrderGetPayload<{ include: { items: true } }>,
  ): Promise<ErpInvoice> {
    const lines = order.items.map((item) => {
      const unit = Number(item.unitPrice);
      const qty = item.quantity;
      const lineTotal = Math.round(unit * qty * 100) / 100;
      return {
        description: item.productName ?? item.sku,
        sku: item.sku,
        quantity: qty,
        unitPrice: unit,
        taxRate: 0,
        total: lineTotal,
      };
    });
    return adapter.createInvoice(credentials, {
      orderRef: order.platformOrderId,
      customerName: order.customerName,
      totalAmount: Number(order.totalAmount),
      currency: order.currency,
      lines,
    });
  }

  private async enqueueListingStockSync(
    organizationId: string,
    barcode: string,
    stock: number,
  ): Promise<void> {
    await this.listingSyncQueue.add(
      'sync-stock',
      { orgId: organizationId, barcode, stock },
      LISTING_SYNC_STOCK_JOB_OPTIONS,
    );
  }

  private async notifyErpInvoiceFailure(
    organizationId: string,
    orderId: string,
    message: string,
    erpType: string,
  ): Promise<void> {
    try {
      await this.inAppNotificationService.create({
        organizationId,
        type: NotificationType.SYNC_ERROR,
        title: 'ERP fatura oluşturulamadı',
        message: `${erpType}: Sipariş ${orderId.slice(0, 8)}… — ${message.slice(0, 200)}`,
        link: '/connections',
        metadata: { orderId, erpType, source: 'erp-invoice' },
      });
    } catch (notifyErr) {
      this.logger.warn('ERP fatura hata bildirimi oluşturulamadı', {
        organizationId,
        orderId,
        error: notifyErr instanceof Error ? notifyErr.message : 'Bilinmeyen hata',
      });
    }
  }

  private async runSyncJob(
    job: Job<ErpSyncJobData>,
    expectedType: ErpSyncJobData['type'],
    run: (
      adapter: IErpAdapter,
      credentials: Record<string, string>,
      ctx: {
        organizationId: string;
        erpConnectionId: string;
        erpType: string;
      },
    ) => Promise<{ processed: number; failed: number }>,
  ): Promise<void> {
    const { organizationId, erpType, type, erpConnectionId } = job.data;
    if (type !== expectedType) {
      return;
    }
    const erp = erpType as ErpType;
    const jobType = ErpSyncSettingsService.erpSyncJobType(
      erpConnectionId,
      type,
    );
    const syncLog = await this.syncLogService.startLog(
      organizationId,
      ErpSyncSettingsService.erpSyncLogPlatform(),
      jobType,
    );

    this.logger.log('ERP senkron işi başladı', {
      organizationId,
      erpType,
      type,
      erpConnectionId,
    });

    try {
      if (!this.adapterRegistry.hasErpAdapter(erpType)) {
        this.logger.warn('ERP adaptörü tanımlı değil', { organizationId, erpType });
        await this.syncLogService.completeLog(syncLog.id, 0, 0);
        return;
      }
      const credentials =
        await this.erpConnectionService.getDecryptedCredentialsForJob(
          organizationId,
          erp,
        );
      if (!credentials) {
        this.logger.warn('Aktif ERP bağlantısı bulunamadı', {
          organizationId,
          erpType,
        });
        await this.syncLogService.failLog(
          syncLog.id,
          'Aktif ERP bağlantısı bulunamadı',
        );
        return;
      }
      const adapter = this.adapterRegistry.getErp(erpType);
      const result = await run(adapter, credentials, {
        organizationId,
        erpConnectionId,
        erpType,
      });
      await this.syncLogService.completeLog(
        syncLog.id,
        result.processed,
        result.failed,
      );
      await this.erpConnectionService.recordSyncSuccess(organizationId, erp);
      await this.erpSyncSettingsService.markSyncCompleted(
        erpConnectionId,
        organizationId,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Bilinmeyen hata';
      this.logger.error('ERP senkron hatası', {
        organizationId,
        erpType,
        type,
        error: message,
      });
      await this.syncLogService.failLog(syncLog.id, message);
      await this.erpConnectionService.recordSyncError(
        organizationId,
        erp,
        message,
      );
      if (type === 'invoices' && job.data.orderId) {
        await this.notifyErpInvoiceFailure(
          organizationId,
          job.data.orderId,
          message,
          erpType,
        );
      }
      throw error;
    }
  }
}
