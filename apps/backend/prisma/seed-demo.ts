import { createCipheriv, randomBytes } from 'crypto';
import {
  Marketplace,
  OrderStatus,
  OrgType,
  PlanTier,
  Prisma,
  PrismaClient,
  StockMovementType,
  SubStatus,
  UserRole,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const DEMO_SLUG = 'demo-magaza';
const DEMO_PASSWORD = 'Demo2024!';
const DEMO_SEED_NOTE = 'demo-seed';

const PRODUCTS: Array<{
  name: string;
  barcode: string;
  category: string;
  listPrice: number;
  salePrice: number;
}> = [
  { name: 'Samsung Galaxy A54 Kılıf', barcode: '8690123456001', category: 'Elektronik', listPrice: 299, salePrice: 199 },
  { name: 'iPhone 15 Temperli Cam', barcode: '8690123456002', category: 'Elektronik', listPrice: 149, salePrice: 89 },
  { name: 'Kablosuz Bluetooth Kulaklık', barcode: '8690123456003', category: 'Elektronik', listPrice: 899, salePrice: 649 },
  { name: 'Şarj Kablosu Type-C 2m', barcode: '8690123456004', category: 'Elektronik', listPrice: 99, salePrice: 59 },
  { name: 'Powerbank 20000mAh', barcode: '8690123456005', category: 'Elektronik', listPrice: 499, salePrice: 349 },
  { name: 'Erkek Slim Fit Gömlek (M)', barcode: '8690123456006', category: 'Giyim', listPrice: 399, salePrice: 279 },
  { name: 'Kadın Yazlık Elbise', barcode: '8690123456007', category: 'Giyim', listPrice: 599, salePrice: 449 },
  { name: 'Unisex Spor Çorap 5li', barcode: '8690123456008', category: 'Giyim', listPrice: 119, salePrice: 79 },
  { name: 'Erkek Deri Cüzdan', barcode: '8690123456009', category: 'Aksesuar', listPrice: 299, salePrice: 199 },
  { name: 'Bayan Çanta Siyah', barcode: '8690123456010', category: 'Aksesuar', listPrice: 799, salePrice: 599 },
  { name: 'Yapışmaz Tava Seti 3lü', barcode: '8690123456011', category: 'Ev & Mutfak', listPrice: 899, salePrice: 699 },
  { name: 'Termos 500ml Paslanmaz', barcode: '8690123456012', category: 'Ev & Mutfak', listPrice: 349, salePrice: 249 },
  { name: 'Dekoratif Mum Seti', barcode: '8690123456013', category: 'Ev & Dekor', listPrice: 199, salePrice: 149 },
  { name: 'Yastık Kılıfı 2li', barcode: '8690123456014', category: 'Ev & Tekstil', listPrice: 149, salePrice: 99 },
  { name: 'Kitap: Atomik Alışkanlıklar', barcode: '8690123456015', category: 'Kitap', listPrice: 119, salePrice: 89 },
  { name: 'Oyun Kartı Seti', barcode: '8690123456016', category: 'Oyun', listPrice: 199, salePrice: 149 },
  { name: 'Yoga Matı 6mm', barcode: '8690123456017', category: 'Spor', listPrice: 399, salePrice: 299 },
  { name: 'Su Şişesi BPA Free 750ml', barcode: '8690123456018', category: 'Spor', listPrice: 149, salePrice: 99 },
  { name: 'Bebek Oyun Halısı', barcode: '8690123456019', category: 'Bebek', listPrice: 699, salePrice: 549 },
  { name: 'Ahşap Oyuncak Seti', barcode: '8690123456020', category: 'Bebek', listPrice: 499, salePrice: 379 },
];

const MARKETPLACE_PLATFORMS: Marketplace[] = [
  Marketplace.TRENDYOL,
  Marketplace.HEPSIBURADA,
  Marketplace.N11,
  Marketplace.AMAZON_TR,
];

const ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.NEW,
  OrderStatus.PICKING,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
  OrderStatus.CANCELLED,
];

const BUYER_NAMES = [
  'Ahmet Yılmaz',
  'Fatma Kaya',
  'Mehmet Demir',
  'Ayşe Öztürk',
  'Mustafa Çelik',
  'Zeynep Arslan',
  'Emre Şahin',
  'Elif Yıldız',
  'Burak Aydın',
  'Selin Koç',
];

function subDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() - days);
  return result;
}

function subHours(date: Date, hours: number): Date {
  const result = new Date(date);
  result.setHours(result.getHours() - hours);
  return result;
}

function encryptCredentials(plaintext: string): string {
  const hexKey = process.env.ENCRYPTION_KEY ?? '';
  if (!/^[0-9a-fA-F]{64}$/.test(hexKey)) {
    throw new Error(
      'ENCRYPTION_KEY geçersiz: 32 bayt (64 hex karakter) olmalıdır.',
    );
  }
  const key = Buffer.from(hexKey, 'hex');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return iv.toString('hex') + authTag.toString('hex') + encrypted.toString('hex');
}

async function seedOrganization(): Promise<{ id: string }> {
  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  const demoOrg = await prisma.organization.upsert({
    where: { slug: DEMO_SLUG },
    update: {
      name: 'Demo Mağaza A.Ş.',
      taxNumber: '1234567890',
      city: 'İstanbul',
      type: OrgType.DIRECT,
      onboardingCompleted: true,
      deletedAt: null,
    },
    create: {
      name: 'Demo Mağaza A.Ş.',
      slug: DEMO_SLUG,
      taxNumber: '1234567890',
      city: 'İstanbul',
      type: OrgType.DIRECT,
      onboardingCompleted: true,
    },
  });

  await prisma.subscription.upsert({
    where: { organizationId: demoOrg.id },
    update: {
      plan: PlanTier.PRO,
      status: SubStatus.ACTIVE,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
    },
    create: {
      organizationId: demoOrg.id,
      plan: PlanTier.PRO,
      status: SubStatus.ACTIVE,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
    },
  });

  return demoOrg;
}

async function seedUsers(organizationId: string): Promise<void> {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  await prisma.user.upsert({
    where: { email: 'demo@senkronize.com' },
    update: {
      name: 'Demo Yönetici',
      passwordHash,
      role: UserRole.OWNER,
      organizationId,
      deletedAt: null,
    },
    create: {
      email: 'demo@senkronize.com',
      name: 'Demo Yönetici',
      passwordHash,
      role: UserRole.OWNER,
      organizationId,
    },
  });

  await prisma.user.upsert({
    where: { email: 'viewer@senkronize.com' },
    update: {
      name: 'Demo Görüntüleyici',
      passwordHash,
      role: UserRole.VIEWER,
      organizationId,
      deletedAt: null,
    },
    create: {
      email: 'viewer@senkronize.com',
      name: 'Demo Görüntüleyici',
      passwordHash,
      role: UserRole.VIEWER,
      organizationId,
    },
  });
}

async function seedMarketplaceConnections(organizationId: string): Promise<void> {
  const credentials = {
    apiKey: 'demo-api-key',
    apiSecret: 'demo-api-secret',
    sellerId: 'demo-seller-001',
  };
  const credentialsEnc = encryptCredentials(JSON.stringify(credentials));

  for (const platform of MARKETPLACE_PLATFORMS) {
    await prisma.marketplaceConnection.upsert({
      where: {
        organizationId_platform: { organizationId, platform },
      },
      update: {
        credentialsEnc,
        isActive: true,
        syncErrorCount: 0,
        deletedAt: null,
        lastSyncAt: subHours(new Date(), 2),
      },
      create: {
        organizationId,
        platform,
        credentialsEnc,
        isActive: true,
        lastSyncAt: subHours(new Date(), 2),
      },
    });
  }
}

async function seedWarehouse(organizationId: string): Promise<{ id: string }> {
  return prisma.warehouse.upsert({
    where: {
      organizationId_code: { organizationId, code: 'MAIN' },
    },
    update: { name: 'Ana Depo', isDefault: true, isActive: true },
    create: {
      organizationId,
      name: 'Ana Depo',
      code: 'MAIN',
      address: 'İkitelli OSB, İstanbul',
      isDefault: true,
      isActive: true,
    },
  });
}

async function seedProducts(
  organizationId: string,
  warehouseId: string,
): Promise<void> {
  for (let i = 0; i < PRODUCTS.length; i++) {
    const p = PRODUCTS[i];
    const stockQty = 15 + (i * 11) % 180;
    const sku = `SKU-${p.barcode.slice(-6)}`;
    const listPriceDec = new Prisma.Decimal(p.listPrice);
    const salePriceDec = new Prisma.Decimal(p.salePrice);

    const product = await prisma.product.upsert({
      where: {
        organizationId_barcode: { organizationId, barcode: p.barcode },
      },
      update: {
        name: p.name,
        sku,
        category: p.category,
        costPrice: new Prisma.Decimal(Math.round(p.salePrice * 0.6)),
        deletedAt: null,
        isActive: true,
      },
      create: {
        organizationId,
        barcode: p.barcode,
        sku,
        name: p.name,
        category: p.category,
        costPrice: new Prisma.Decimal(Math.round(p.salePrice * 0.6)),
        imageUrls: [],
      },
    });

    const platform =
      MARKETPLACE_PLATFORMS[i % MARKETPLACE_PLATFORMS.length] ??
      Marketplace.TRENDYOL;
    const platformProductId = `${platform}-DEMO-${p.barcode}`;

    await prisma.listing.upsert({
      where: {
        organizationId_platform_platformProductId: {
          organizationId,
          platform,
          platformProductId,
        },
      },
      update: {
        productId: product.id,
        barcode: p.barcode,
        title: p.name,
        salePrice: salePriceDec,
        listPrice: listPriceDec,
        quantity: stockQty,
        approved: stockQty > 0,
        deletedAt: null,
      },
      create: {
        organizationId,
        productId: product.id,
        platform,
        platformProductId,
        barcode: p.barcode,
        title: p.name,
        salePrice: salePriceDec,
        listPrice: listPriceDec,
        quantity: stockQty,
        imageUrls: [],
        approved: stockQty > 0,
      },
    });

    await prisma.stockEntry.upsert({
      where: {
        organizationId_barcode_platform_warehouseId: {
          organizationId,
          barcode: p.barcode,
          platform: null,
          warehouseId,
        },
      },
      update: {
        productId: product.id,
        quantity: stockQty,
        reservedQty: Math.min(5, Math.floor(stockQty / 10)),
      },
      create: {
        organizationId,
        warehouseId,
        productId: product.id,
        barcode: p.barcode,
        platform: null,
        quantity: stockQty,
        reservedQty: Math.min(5, Math.floor(stockQty / 10)),
      },
    });
  }
}

async function seedOrders(organizationId: string): Promise<void> {
  for (let i = 0; i < 50; i++) {
    const product = PRODUCTS[i % PRODUCTS.length];
    const platform =
      MARKETPLACE_PLATFORMS[i % MARKETPLACE_PLATFORMS.length] ??
      Marketplace.TRENDYOL;
    const status = ORDER_STATUSES[i % ORDER_STATUSES.length];
    const buyer = BUYER_NAMES[i % BUYER_NAMES.length];
    const daysAgo = i % 30;
    const hoursOffset = i % 12;
    const quantity = (i % 3) + 1;
    const platformOrderId = `DEMO-ORD-${String(i + 1).padStart(3, '0')}`;

    const orderCreatedAt = subHours(subDays(new Date(), daysAgo), hoursOffset);
    const unitPrice = new Prisma.Decimal(product.salePrice);
    const lineTotal = unitPrice.mul(quantity);

    const existing = await prisma.order.findUnique({
      where: {
        organizationId_platform_platformOrderId: {
          organizationId,
          platform,
          platformOrderId,
        },
      },
      include: { items: true },
    });

    if (existing) {
      await prisma.order.update({
        where: { id: existing.id },
        data: {
          status,
          customerName: buyer,
          customerPhone: `05${String(300000000 + i).slice(-9)}`,
          shippingAddress: `Demo Mah. ${i + 1}. Sok. No:${(i % 40) + 1}, İstanbul`,
          totalAmount: lineTotal,
          platformCreatedAt: orderCreatedAt,
          deletedAt: null,
        },
      });
      if (existing.items.length === 0) {
        await prisma.orderItem.create({
          data: {
            orderId: existing.id,
            organizationId,
            barcode: product.barcode,
            sku: `SKU-${product.barcode.slice(-6)}`,
            productName: product.name,
            quantity,
            unitPrice,
            platformItemId: `ITEM-${platformOrderId}`,
          },
        });
      }
      continue;
    }

    await prisma.order.create({
      data: {
        organizationId,
        platformOrderId,
        platform,
        status,
        customerName: buyer,
        customerPhone: `05${String(300000000 + i).slice(-9)}`,
        shippingAddress: `Demo Mah. ${i + 1}. Sok. No:${(i % 40) + 1}, İstanbul`,
        totalAmount: lineTotal,
        currency: 'TRY',
        platformCreatedAt: orderCreatedAt,
        createdAt: orderCreatedAt,
        cargoProvider: status === OrderStatus.SHIPPED || status === OrderStatus.DELIVERED
          ? 'YURTICI'
          : undefined,
        cargoTrackingNumber:
          status === OrderStatus.SHIPPED || status === OrderStatus.DELIVERED
            ? `YK${String(1000000 + i)}`
            : undefined,
        items: {
          create: [
            {
              organizationId,
              barcode: product.barcode,
              sku: `SKU-${product.barcode.slice(-6)}`,
              productName: product.name,
              quantity,
              unitPrice,
              platformItemId: `ITEM-${platformOrderId}`,
            },
          ],
        },
      },
    });
  }
}

async function seedStockMovements(
  organizationId: string,
  warehouseId: string,
): Promise<void> {
  await prisma.stockMovement.deleteMany({
    where: { organizationId, note: DEMO_SEED_NOTE },
  });

  const movements: Array<{
    barcode: string;
    movementType: StockMovementType;
    quantity: number;
    daysAgo: number;
    platform: string | null;
  }> = [];

  for (let i = 0; i < PRODUCTS.length; i++) {
    const p = PRODUCTS[i];
    movements.push({
      barcode: p.barcode,
      movementType: StockMovementType.PURCHASE,
      quantity: 20 + (i % 30),
      daysAgo: 45 - (i % 30),
      platform: null,
    });
    movements.push({
      barcode: p.barcode,
      movementType: StockMovementType.SALE,
      quantity: -(3 + (i % 8)),
      daysAgo: 20 - (i % 15),
      platform: MARKETPLACE_PLATFORMS[i % MARKETPLACE_PLATFORMS.length],
    });
  }

  for (const m of movements) {
    const createdAt = subDays(new Date(), m.daysAgo);
    const beforeQty = 50 + Math.abs(m.quantity);
    const afterQty = beforeQty + m.quantity;

    await prisma.stockMovement.create({
      data: {
        organizationId,
        warehouseId,
        barcode: m.barcode,
        platform: m.platform,
        movementType: m.movementType,
        quantity: m.quantity,
        beforeQuantity: beforeQty,
        afterQuantity: afterQty,
        note: DEMO_SEED_NOTE,
        createdAt,
      },
    });
  }
}

async function main(): Promise<void> {
  console.log('Demo seed başlıyor...');

  const demoOrg = await seedOrganization();
  await seedUsers(demoOrg.id);
  await seedMarketplaceConnections(demoOrg.id);
  const warehouse = await seedWarehouse(demoOrg.id);
  await seedProducts(demoOrg.id, warehouse.id);
  await seedOrders(demoOrg.id);
  await seedStockMovements(demoOrg.id, warehouse.id);

  console.log('✅ Demo seed tamamlandı.');
  console.log(`   Organizasyon: ${DEMO_SLUG}`);
  console.log(`   Ürün: ${PRODUCTS.length}, Sipariş: 50, Bağlantı: ${MARKETPLACE_PLATFORMS.length}`);
  console.log(`   Giriş: demo@senkronize.com / ${DEMO_PASSWORD}`);
  console.log(`   Görüntüleyici: viewer@senkronize.com / ${DEMO_PASSWORD}`);
}

main()
  .catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
