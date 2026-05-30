import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import {
  ErpType,
  NotificationType,
  OrderStatus,
  Prisma,
  StockMovementType,
} from '@prisma/client';
import type { ErpInvoice, ErpProduct, ErpProductImportOptions, IErpAdapter } from '@senkronize/shared';
import type { Job } from 'bull';

import { AdapterRegistry } from '../adapters/adapter.registry';
import {
  buildProductWhereForMatchKey,
  type ProductMatchKey,
} from '../common/product-match-key';
import {
  buildProductCatalogWrite,
  resolveErpCatalogFields,
} from '../common/erp-product-catalog.util';
import { BizimHesapErpAdapter } from '../adapters/erp/bizimhesap/bizimhesap.adapter';
import { BizimHesapRateLimitService } from '../adapters/erp/bizimhesap/bizimhesap-rate-limit.service';
import { BizimHesapRateLimitBlockedException } from '../adapters/erp/bizimhesap/bizimhesap-rate-limit.exceptions';
import { buildErpProductImportOptions } from '../common/erp-product-import.util';
import { ProductMatchKeyService } from '../common/product-match-key.service';
import { upsertErpStockAndMergeCentral } from '../erp-connection/erp-stock-merge.util';
import { ErpConnectionService } from '../erp-connection/erp-connection.service';
import { ErpProductReconcileService } from '../erp-connection/erp-product-reconcile.service';
import { ErpSyncSettingsService } from '../erp/erp-sync-settings.service';
import { InAppNotificationService } from '../notifications/in-app/in-app-notification.service';
import { NotificationEmitService } from '../notifications/notification-emit.service';
import { PrismaService } from '../prisma/prisma.service';
import { QUEUE_ERP_SYNC } from '../queue/queue.constants';
import type {
  BizimHesapOrgSyncJobData,
  ErpSyncJobData,
} from '../queue/queue.types';
import { ListingPushService } from '../sync/listing-push.service';
import { SyncLogService } from '../sync/sync-log.service';
import { WarehouseService } from '../warehouse/warehouse.service';
import { ProductMatchService } from '../product-match/product-match.service';

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
    private readonly notificationEmit: NotificationEmitService,
    private readonly bizimHesapRateLimit: BizimHesapRateLimitService,
    private readonly productMatchKeyService: ProductMatchKeyService,
    private readonly productMatchService: ProductMatchService,
    private readonly erpProductReconcile: ErpProductReconcileService,
    private readonly listingPushService: ListingPushService,
  ) {}

  @Process('sync-products')
  async handleSyncProducts(job: Job<ErpSyncJobData>): Promise<void> {
    await this.runSyncJob(job, 'products', async (adapter, credentials, ctx) => {
      const importOptions = await this.resolveProductImportOptions(
        ctx.organizationId,
        ctx.erpConnectionId,
      );
      const erpProducts = await this.fetchErpProducts(
        adapter,
        credentials,
        importOptions,
        ctx.organizationId,
      );
      const mainWh = await this.warehouseService.getOrCreateMainWarehouse(
        ctx.organizationId,
      );
      const defaultMatchKey = await this.productMatchKeyService.resolveForErpConnection(
        ctx.organizationId,
        ctx.erpConnectionId,
      );
      if (defaultMatchKey === null) {
        this.logger.warn('ERP ürün sync atlandı: eşleştirme yöntemi seçilmemiş', {
          organizationId: ctx.organizationId,
        });
        return { processed: 0, failed: erpProducts.length };
      }
      let processed = 0;
      let failed = 0;
      const syncedStockKeys = new Set<string>();
      const pendingStockPushes = new Map<string, number>();

      for (const erpProduct of erpProducts) {
        const catalog = resolveErpCatalogFields(erpProduct);
        const catalogWrite = buildProductCatalogWrite(catalog);
        if (!catalogWrite) {
          failed += 1;
          continue;
        }
        const { catalogBarcode, catalogSku, stockKey } = catalog;
        syncedStockKeys.add(stockKey);
        const { barcode: productBarcode, sku: productSku } = catalogWrite;

        try {
          const existingByDefault =
            defaultMatchKey === 'MANUAL'
              ? await this.findExistingProductForManual(ctx.organizationId, {
                  barcode: catalogBarcode,
                  sku: catalogSku,
                })
              : await this.prisma.product.findFirst({
                  where:
                    buildProductWhereForMatchKey(ctx.organizationId, defaultMatchKey, {
                      barcode: catalogBarcode,
                      sku: catalogSku,
                    }) ?? undefined,
                });
          let existingProduct = existingByDefault;
          if (!existingProduct && productBarcode) {
            existingProduct = await this.prisma.product.findFirst({
              where: {
                organizationId: ctx.organizationId,
                barcode: productBarcode,
                deletedAt: null,
              },
            });
          }
          if (!existingProduct && catalogSku.length > 0) {
            existingProduct = await this.prisma.product.findFirst({
              where: {
                organizationId: ctx.organizationId,
                deletedAt: null,
                OR: [
                  { sku: catalogSku },
                  { barcode: catalogSku },
                ],
              },
            });
          }

          const shouldRepairBarcode =
            existingProduct !== null &&
            catalogBarcode.length > 0 &&
            existingProduct.barcode !== catalogBarcode &&
            (existingProduct.barcode === catalogSku ||
              existingProduct.sku === catalogSku ||
              existingProduct.barcode === existingProduct.sku);

          const shouldClearBarcode =
            existingProduct !== null &&
            catalogBarcode.length === 0 &&
            catalogSku.length > 0 &&
            existingProduct.barcode !== null &&
            (existingProduct.barcode === catalogSku ||
              existingProduct.barcode === existingProduct.sku);

          const matchKey: ProductMatchKey | null = existingProduct
            ? await this.productMatchKeyService.resolveForErpConnection(
                ctx.organizationId,
                ctx.erpConnectionId,
                existingProduct.productMatchKey,
              )
            : defaultMatchKey;

          if (matchKey === null || (matchKey === 'MANUAL' && !existingProduct)) {
            continue;
          }

          const priorStock = await this.prisma.stockEntry.findFirst({
            where: {
              organizationId: ctx.organizationId,
              barcode: stockKey,
              platform: null,
              warehouseId: mainWh.id,
            },
            select: { quantity: true },
          });
          const beforeQty = priorStock?.quantity ?? 0;
          const afterQty = erpProduct.stockQuantity;

          await this.prisma.$transaction(async (tx) => {
            const costPrice = toDecimal(erpProduct.purchasePrice);
            let productId = existingProduct?.id ?? null;

            if (existingProduct) {
              await tx.product.update({
                where: { id: existingProduct.id },
                data: {
                  name: erpProduct.name,
                  deletedAt: null,
                  sku: productSku,
                  ...(shouldClearBarcode ? { barcode: null } : {}),
                  ...(shouldRepairBarcode ? { barcode: catalogBarcode } : {}),
                  ...(costPrice !== undefined ? { costPrice } : {}),
                },
              });
            } else if (matchKey !== 'MANUAL') {
              const created = await tx.product.create({
                data: {
                  organizationId: ctx.organizationId,
                  barcode: productBarcode,
                  name: erpProduct.name,
                  sku: productSku,
                  sourceErpConnectionId: ctx.erpConnectionId,
                  ...(costPrice !== undefined ? { costPrice } : {}),
                },
              });
              productId = created.id;
            }

            await upsertErpStockAndMergeCentral(tx, {
              organizationId: ctx.organizationId,
              erpConnectionId: ctx.erpConnectionId,
              warehouseId: mainWh.id,
              barcode: stockKey,
              quantity: afterQty,
              productId: productId,
            });
            if (beforeQty !== afterQty) {
              await tx.stockMovement.create({
                data: {
                  organizationId: ctx.organizationId,
                  barcode: stockKey,
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
            pendingStockPushes.set(stockKey, afterQty);
          }
          processed += 1;
        } catch (error) {
          failed += 1;
          this.logger.warn('ERP ürün senkronu başarısız', {
            organizationId: ctx.organizationId,
            barcode: stockKey,
            error: error instanceof Error ? error.message : 'Bilinmeyen hata',
          });
        }
      }

      await this.listingPushService.enqueueStockPushBatch(
        ctx.organizationId,
        pendingStockPushes,
      );

      try {
        const reconcileResult = await this.erpProductReconcile.reconcileAfterImport(
          ctx.organizationId,
          ctx.erpConnectionId,
          syncedStockKeys,
        );
        if (reconcileResult.removedProducts > 0) {
          this.logger.log('ERP import filtresi dışı ürünler kaldırıldı', {
            organizationId: ctx.organizationId,
            erpConnectionId: ctx.erpConnectionId,
            removedProducts: reconcileResult.removedProducts,
            staleStockEntries: reconcileResult.staleStockEntries,
          });
        }
      } catch (reconcileError) {
        this.logger.warn('ERP import reconcile başarısız', {
          organizationId: ctx.organizationId,
          erpConnectionId: ctx.erpConnectionId,
          error:
            reconcileError instanceof Error
              ? reconcileError.message
              : 'Bilinmeyen hata',
        });
      }

      try {
        const matchResult = await this.productMatchService.autoMatchListings(
          ctx.organizationId,
        );
        if (matchResult.listingsLinked > 0) {
          this.logger.log('ERP sync sonrası ürün eşleştirmesi tamamlandı', {
            organizationId: ctx.organizationId,
            ...matchResult,
          });
        }
      } catch (matchError) {
        this.logger.warn('ERP sync sonrası ürün eşleştirmesi başarısız', {
          organizationId: ctx.organizationId,
          error:
            matchError instanceof Error ? matchError.message : 'Bilinmeyen hata',
        });
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

  @Process('bizimhesap-org-sync')
  async handleBizimHesapOrgSync(
    job: Job<BizimHesapOrgSyncJobData>,
  ): Promise<void> {
    const { organizationId, erpConnectionIds, syncType, triggerConnectionId } =
      job.data;
    const manualSyncType = this.erpSyncSettingsService.toManualSyncType(syncType);
    const rateStatus = await this.bizimHesapRateLimit.getStatus(organizationId);
    const startedAt = Date.now();

    this.logger.log('BizimHesap org batch sync başladı', {
      organizationId,
      connectionCount: erpConnectionIds.length,
    });

    for (let i = 0; i < erpConnectionIds.length; i += 1) {
      const erpConnectionId = erpConnectionIds[i];
      const payloads = await this.erpSyncSettingsService.getSyncPayloadsForConnection(
        organizationId,
        erpConnectionId,
        manualSyncType,
      );

      for (let j = 0; j < payloads.length; j += 1) {
        const payload: ErpSyncJobData = {
          ...payloads[j],
          batchIndex: j,
          batchTotal: payloads.length,
        };
        await this.dispatchErpSyncJob({ data: payload } as Job<ErpSyncJobData>);
      }

      if (i < erpConnectionIds.length - 1) {
        await this.sleep(rateStatus.minSyncIntervalMs);
      }
    }

    this.notificationEmit.emitSyncCompleted(organizationId, {
      connectionId: triggerConnectionId ?? erpConnectionIds[0],
      platform: ErpType.BIZIMHESAP,
      processed: erpConnectionIds.length,
      duration: Date.now() - startedAt,
    });
  }

  @Process('sync-stock')
  async handleSyncStock(job: Job<ErpSyncJobData>): Promise<void> {
    await this.runSyncJob(job, 'stock', async (adapter, credentials, ctx) => {
      if (job.data.direction === 'push' && job.data.barcode && job.data.quantity !== undefined) {
        return this.pushStockToErp(
          adapter,
          credentials,
          ctx.organizationId,
          ctx.erpConnectionId,
          job.data.barcode,
          job.data.quantity,
        );
      }
      return this.pullStockFromErp(
        adapter,
        credentials,
        ctx.organizationId,
        ctx.erpConnectionId,
      );
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
            ctx.organizationId,
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
          ctx.organizationId,
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
        ctx.erpConnectionId,
        barcode,
        quantity,
      );
    });
  }

  private async pullStockFromErp(
    adapter: IErpAdapter,
    credentials: Record<string, string>,
    organizationId: string,
    erpConnectionId: string,
  ): Promise<{ processed: number; failed: number }> {
    const importOptions = await this.resolveProductImportOptions(
      organizationId,
      erpConnectionId,
    );
    const erpProducts = await this.fetchErpProducts(
      adapter,
      credentials,
      importOptions,
      organizationId,
    );
    const mainWh = await this.warehouseService.getOrCreateMainWarehouse(organizationId);
    const matchKey = await this.productMatchKeyService.resolveForErpConnection(
      organizationId,
      erpConnectionId,
    );
    if (matchKey === null) {
      this.logger.warn('ERP stok sync atlandı: eşleştirme yöntemi seçilmemiş', {
        organizationId,
      });
      return { processed: 0, failed: erpProducts.length };
    }
    let processed = 0;
    let failed = 0;
    const pendingStockPushes = new Map<string, number>();

    for (const erpProduct of erpProducts) {
      const catalog = resolveErpCatalogFields(erpProduct);
      const catalogWrite = buildProductCatalogWrite(catalog);
      if (!catalogWrite) {
        failed += 1;
        continue;
      }
      const { catalogBarcode, catalogSku, stockKey } = catalog;
      const { barcode: productBarcode } = catalogWrite;

      if (matchKey === 'MANUAL') {
        const existing = await this.findExistingProductForManual(organizationId, {
          barcode: catalogBarcode,
          sku: catalogSku,
        });
        if (!existing) {
          continue;
        }
      }

      try {
          const priorStock = await this.prisma.stockEntry.findFirst({
            where: {
              organizationId,
              barcode: stockKey,
              platform: null,
              warehouseId: mainWh.id,
            },
            select: { quantity: true },
          });
          const beforeQty = priorStock?.quantity ?? 0;
          const afterQty = erpProduct.stockQuantity;

          await this.prisma.$transaction(async (tx) => {
            const productWhere =
              matchKey === 'SKU'
                ? buildProductWhereForMatchKey(organizationId, matchKey, {
                    barcode: catalogBarcode,
                    sku: catalogSku,
                  })
                : productBarcode
                  ? { organizationId, barcode: productBarcode, deletedAt: null }
                  : catalogSku
                    ? { organizationId, sku: catalogSku, deletedAt: null }
                    : null;
            const product = productWhere
              ? await tx.product.findFirst({
                  where: productWhere,
                  select: { id: true },
                })
              : null;
            await upsertErpStockAndMergeCentral(tx, {
              organizationId,
              erpConnectionId,
              warehouseId: mainWh.id,
              barcode: stockKey,
              quantity: afterQty,
              productId: product?.id ?? null,
            });
            if (beforeQty !== afterQty) {
              await tx.stockMovement.create({
                data: {
                  organizationId,
                  barcode: stockKey,
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
            pendingStockPushes.set(stockKey, afterQty);
          }
          processed += 1;
      } catch (error) {
        failed += 1;
        this.logger.warn('ERP stok çekme başarısız', {
          organizationId,
          barcode: stockKey,
          error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        });
      }
    }

    await this.listingPushService.enqueueStockPushBatch(
      organizationId,
      pendingStockPushes,
    );

    return { processed, failed };
  }

  private async findExistingProductForManual(
    organizationId: string,
    ids: { barcode: string; sku: string },
  ) {
    const barcode = ids.barcode.trim();
    const sku = ids.sku.trim();
    const or: Array<{ barcode: string } | { sku: string }> = [];
    if (barcode.length > 0) {
      or.push({ barcode });
    }
    if (sku.length > 0) {
      or.push({ sku });
    }
    if (or.length === 0) {
      return null;
    }
    return this.prisma.product.findFirst({
      where: { organizationId, deletedAt: null, OR: or },
    });
  }

  private async pushStockToErp(
    adapter: IErpAdapter,
    credentials: Record<string, string>,
    organizationId: string,
    erpConnectionId: string,
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

    const importOptions = await this.resolveProductImportOptions(
      organizationId,
      erpConnectionId,
    );
    const erpProducts = await this.fetchErpProducts(
      adapter,
      credentials,
      importOptions,
      organizationId,
    );
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
    organizationId: string,
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
    const payload = {
      orderRef: order.platformOrderId,
      customerName: order.customerName,
      totalAmount: Number(order.totalAmount),
      currency: order.currency,
      lines,
    };
    if (adapter.erpType === 'BIZIMHESAP') {
      return (adapter as BizimHesapErpAdapter).createInvoice(
        credentials,
        payload,
        organizationId,
      );
    }
    return adapter.createInvoice(credentials, payload);
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

  private async fetchErpProducts(
    adapter: IErpAdapter,
    credentials: Record<string, string>,
    importOptions: ErpProductImportOptions,
    organizationId: string,
  ): Promise<ErpProduct[]> {
    if (adapter.erpType === 'BIZIMHESAP') {
      return (adapter as BizimHesapErpAdapter).getProducts(
        credentials,
        importOptions,
        organizationId,
      );
    }
    return adapter.getProducts(credentials);
  }

  private async resolveProductImportOptions(
    organizationId: string,
    erpConnectionId: string,
  ): Promise<ErpProductImportOptions> {
    const settings = await this.erpSyncSettingsService.getSettings(
      organizationId,
      erpConnectionId,
    );
    return buildErpProductImportOptions(settings);
  }

  private formatSyncErrorMessage(error: unknown): string {
    const message = error instanceof Error ? error.message : 'Bilinmeyen hata';
    if (message.includes('429')) {
      return 'BizimHesap API istek limiti aşıldı. Lütfen birkaç dakika bekleyip tekrar deneyin.';
    }
    return message;
  }

  private emitErpSyncProgress(
    job: Job<ErpSyncJobData>,
    current: number,
    total: number,
    phase: string,
  ): void {
    const { organizationId, erpConnectionId, erpType } = job.data;
    this.notificationEmit.emitSyncProgress(organizationId, {
      connectionId: erpConnectionId,
      platform: erpType,
      phase,
      current,
      total,
    });
  }

  private emitErpSyncCompleted(
    job: Job<ErpSyncJobData>,
    processed: number,
    startedAt: number,
  ): void {
    const { organizationId, erpConnectionId, erpType } = job.data;
    this.notificationEmit.emitSyncCompleted(organizationId, {
      connectionId: erpConnectionId,
      platform: erpType,
      processed,
      duration: Date.now() - startedAt,
    });
  }

  private emitErpSyncError(job: Job<ErpSyncJobData>, error: unknown): void {
    const { organizationId, erpConnectionId, erpType } = job.data;
    this.notificationEmit.emitSyncError(organizationId, {
      connectionId: erpConnectionId,
      platform: erpType,
      error: this.formatSyncErrorMessage(error),
    });
  }

  private notifyErpSyncOutcome(
    job: Job<ErpSyncJobData>,
    result: { processed: number; failed: number },
    startedAt: number,
  ): void {
    const { batchIndex, batchTotal, type } = job.data;
    if (batchTotal !== undefined && batchIndex !== undefined) {
      this.emitErpSyncProgress(job, batchIndex + 1, batchTotal, type);
      if (batchIndex + 1 >= batchTotal) {
        this.emitErpSyncCompleted(job, result.processed, startedAt);
      }
      return;
    }
    this.emitErpSyncCompleted(job, result.processed, startedAt);
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
      erpType,
      type,
    );
    const syncLog = await this.syncLogService.startLog(
      organizationId,
      ErpSyncSettingsService.erpSyncLogPlatform(),
      jobType,
    );
    const startedAt = Date.now();

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
          erpConnectionId,
        );
      if (!credentials) {
        const hasConnection =
          (await this.erpConnectionService.findActiveByOrgAndType(
            organizationId,
            erp,
          )) ??
          (await this.prisma.erpConnection.findFirst({
            where: {
              id: erpConnectionId,
              organizationId,
              deletedAt: null,
              isActive: true,
            },
          }));
        const message = hasConnection
          ? 'ERP kimlik bilgileri okunamadı'
          : 'Aktif ERP bağlantısı bulunamadı';
        this.logger.warn(message, {
          organizationId,
          erpType,
          erpConnectionId,
        });
        await this.syncLogService.failLog(syncLog.id, message);
        return;
      }
      if (erp === ErpType.BIZIMHESAP) {
        try {
          await this.bizimHesapRateLimit.assertCanRequest(organizationId);
        } catch (error) {
          const message =
            error instanceof BizimHesapRateLimitBlockedException
              ? error.message
              : error instanceof Error
                ? error.message
                : 'BizimHesap istek limiti aktif';
          await this.bizimHesapRateLimit.recordSyncSkipped(organizationId, message);
          await this.syncLogService.failLog(syncLog.id, message);
          this.emitErpSyncError(job, error);
          return;
        }
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
      await this.erpConnectionService.recordSyncSuccess(
        organizationId,
        erpConnectionId,
      );
      await this.erpSyncSettingsService.markSyncCompleted(
        erpConnectionId,
        organizationId,
      );
      this.notifyErpSyncOutcome(job, result, startedAt);
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
        erpConnectionId,
        message,
      );
      this.emitErpSyncError(job, error);
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

  private async dispatchErpSyncJob(job: Job<ErpSyncJobData>): Promise<void> {
    switch (job.data.type) {
      case 'products':
        await this.handleSyncProducts(job);
        break;
      case 'stock':
        await this.handleSyncStock(job);
        break;
      case 'invoices':
        await this.handleSyncInvoices(job);
        break;
      case 'customers':
        await this.handleSyncCustomers(job);
        break;
      default:
        break;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}
