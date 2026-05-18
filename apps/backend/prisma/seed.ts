import {
  Marketplace,
  OrderStatus,
  OrgType,
  PlanTier,
  Prisma,
  PrismaClient,
  SubStatus,
  UserRole,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const PLATFORM_ORG_SLUG = 'senkronize-platform';

const SEED_DEMO = process.env.SEED_DEMO === 'true';

type DemoProductRow = {
  barcode: string;
  name: string;
  category: string;
  brand: string;
  salePrice: number;
  stock: number;
};

async function seedSuperAdminIfConfigured(): Promise<void> {
  const emailRaw = process.env.SEED_SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_SUPER_ADMIN_PASSWORD;

  if (!emailRaw || !password) {
    console.log(
      'SEED_SUPER_ADMIN_EMAIL ve SEED_SUPER_ADMIN_PASSWORD tanımlı değil; super admin seed atlandı.',
    );
    return;
  }

  const existingUser = await prisma.user.findFirst({
    where: { email: emailRaw, deletedAt: null },
  });
  if (existingUser) {
    console.log('Super admin seed: kullanıcı zaten var, atlanıyor.');
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setFullYear(periodEnd.getFullYear() + 10);

  await prisma.$transaction(async (tx) => {
    let org = await tx.organization.findFirst({
      where: { slug: PLATFORM_ORG_SLUG, deletedAt: null },
    });
    if (!org) {
      org = await tx.organization.create({
        data: {
          slug: PLATFORM_ORG_SLUG,
          name: 'Senkronize Platform',
          type: OrgType.DIRECT,
          onboardingCompleted: true,
        },
      });
      await tx.subscription.create({
        data: {
          organizationId: org.id,
          plan: PlanTier.KURUMSAL,
          status: SubStatus.ACTIVE,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        },
      });
    }

    await tx.user.create({
      data: {
        organizationId: org.id,
        email: emailRaw,
        name: 'Platform Süper Admin',
        passwordHash,
        role: UserRole.SUPER_ADMIN,
      },
    });
  });

  console.log('Super admin kullanıcı oluşturuldu:', emailRaw);
}

async function seedDemoData(client: PrismaClient): Promise<void> {
  if (!SEED_DEMO) {
    return;
  }

  console.log('Demo veri oluşturuluyor...');

  const demoOrg = await client.organization.upsert({
    where: { slug: 'demo-magaza' },
    update: {},
    create: {
      name: 'Demo Mağaza A.Ş.',
      slug: 'demo-magaza',
      type: OrgType.DIRECT,
      onboardingCompleted: true,
    },
  });

  const hashedPassword = await bcrypt.hash('demo123456', 10);
  await client.user.upsert({
    where: { email: 'demo@senkronize.com' },
    update: {
      name: 'Demo Kullanıcı',
      passwordHash: hashedPassword,
      role: UserRole.OWNER,
      organizationId: demoOrg.id,
      deletedAt: null,
    },
    create: {
      email: 'demo@senkronize.com',
      name: 'Demo Kullanıcı',
      passwordHash: hashedPassword,
      role: UserRole.OWNER,
      organizationId: demoOrg.id,
    },
  });

  const now = new Date();
  const trialEndsAt = new Date(Date.now() + 14 * 86_400_000);
  await client.subscription.upsert({
    where: { organizationId: demoOrg.id },
    update: {
      plan: PlanTier.PRO,
      status: SubStatus.TRIAL,
      trialEndsAt,
      currentPeriodStart: now,
      currentPeriodEnd: trialEndsAt,
    },
    create: {
      organizationId: demoOrg.id,
      plan: PlanTier.PRO,
      status: SubStatus.TRIAL,
      trialEndsAt,
      currentPeriodStart: now,
      currentPeriodEnd: trialEndsAt,
    },
  });

  const productData: DemoProductRow[] = [
    {
      barcode: '8680000000001',
      name: 'iPhone 15 Pro Kılıf',
      category: 'Telefon Aksesuarı',
      brand: 'DemoMarka',
      salePrice: 299,
      stock: 45,
    },
    {
      barcode: '8680000000002',
      name: 'Samsung Galaxy A54 Ekran Koruyucu',
      category: 'Telefon Aksesuarı',
      brand: 'DemoMarka',
      salePrice: 89,
      stock: 120,
    },
    {
      barcode: '8680000000003',
      name: 'Kablosuz Kulaklık',
      category: 'Elektronik',
      brand: 'TechBrand',
      salePrice: 799,
      stock: 15,
    },
    {
      barcode: '8680000000004',
      name: 'Şarj Kablosu USB-C 2m',
      category: 'Kablo',
      brand: 'TechBrand',
      salePrice: 129,
      stock: 200,
    },
    {
      barcode: '8680000000005',
      name: 'Laptop Çantası 15"',
      category: 'Çanta',
      brand: 'BagBrand',
      salePrice: 449,
      stock: 8,
    },
    {
      barcode: '8680000000006',
      name: 'Bluetooth Hoparlör',
      category: 'Elektronik',
      brand: 'SoundBrand',
      salePrice: 599,
      stock: 30,
    },
    {
      barcode: '8680000000007',
      name: 'Gaming Mouse',
      category: 'Bilgisayar',
      brand: 'GameBrand',
      salePrice: 349,
      stock: 25,
    },
    {
      barcode: '8680000000008',
      name: 'Mekanik Klavye',
      category: 'Bilgisayar',
      brand: 'GameBrand',
      salePrice: 899,
      stock: 12,
    },
    {
      barcode: '8680000000009',
      name: 'Monitör Standı',
      category: 'Masa Aksesuarı',
      brand: 'OfficeBrand',
      salePrice: 279,
      stock: 3,
    },
    {
      barcode: '8680000000010',
      name: 'USB Hub 4 Port',
      category: 'Bilgisayar',
      brand: 'TechBrand',
      salePrice: 199,
      stock: 67,
    },
    {
      barcode: '8680000000011',
      name: 'Webcam 1080p',
      category: 'Elektronik',
      brand: 'TechBrand',
      salePrice: 549,
      stock: 18,
    },
    {
      barcode: '8680000000012',
      name: 'Mousepad XL',
      category: 'Bilgisayar',
      brand: 'GameBrand',
      salePrice: 149,
      stock: 85,
    },
    {
      barcode: '8680000000013',
      name: 'Smart Watch Band',
      category: 'Akıllı Saat',
      brand: 'WatchBrand',
      salePrice: 179,
      stock: 0,
    },
    {
      barcode: '8680000000014',
      name: 'Laptop Soğutucu',
      category: 'Bilgisayar',
      brand: 'TechBrand',
      salePrice: 399,
      stock: 5,
    },
    {
      barcode: '8680000000015',
      name: 'HDMI Kablo 2m',
      category: 'Kablo',
      brand: 'TechBrand',
      salePrice: 99,
      stock: 150,
    },
    {
      barcode: '8680000000016',
      name: 'Powerbank 20000mAh',
      category: 'Elektronik',
      brand: 'EnergyBrand',
      salePrice: 699,
      stock: 22,
    },
    {
      barcode: '8680000000017',
      name: 'Telefon Tutucu Araç',
      category: 'Araç Aksesuarı',
      brand: 'AutoBrand',
      salePrice: 159,
      stock: 0,
    },
    {
      barcode: '8680000000018',
      name: 'Akıllı Ampul RGB',
      category: 'Akıllı Ev',
      brand: 'SmartBrand',
      salePrice: 249,
      stock: 40,
    },
    {
      barcode: '8680000000019',
      name: 'Şarj Standı Kablosuz',
      category: 'Elektronik',
      brand: 'EnergyBrand',
      salePrice: 449,
      stock: 4,
    },
    {
      barcode: '8680000000020',
      name: 'Laptop Çantası 13"',
      category: 'Çanta',
      brand: 'BagBrand',
      salePrice: 349,
      stock: 60,
    },
  ];

  for (const p of productData) {
    const product = await client.product.upsert({
      where: {
        organizationId_barcode: { organizationId: demoOrg.id, barcode: p.barcode },
      },
      update: {
        name: p.name,
        category: p.category,
        brand: p.brand,
        deletedAt: null,
      },
      create: {
        organizationId: demoOrg.id,
        barcode: p.barcode,
        name: p.name,
        category: p.category,
        brand: p.brand,
        imageUrls: [],
      },
    });

    const listPrice = new Prisma.Decimal(Math.round(p.salePrice * 1.2));
    const salePriceDec = new Prisma.Decimal(p.salePrice);
    const platformProductId = `TY-${p.barcode}`;

    await client.listing.upsert({
      where: {
        organizationId_platform_platformProductId: {
          organizationId: demoOrg.id,
          platform: Marketplace.TRENDYOL,
          platformProductId,
        },
      },
      update: {
        productId: product.id,
        barcode: p.barcode,
        title: p.name,
        salePrice: salePriceDec,
        listPrice,
        quantity: p.stock,
        approved: p.stock > 0,
        deletedAt: null,
      },
      create: {
        organizationId: demoOrg.id,
        productId: product.id,
        platform: Marketplace.TRENDYOL,
        platformProductId,
        barcode: p.barcode,
        title: p.name,
        salePrice: salePriceDec,
        listPrice,
        quantity: p.stock,
        imageUrls: [],
        approved: p.stock > 0,
      },
    });
  }

  const platforms: Marketplace[] = [
    Marketplace.TRENDYOL,
    Marketplace.HEPSIBURADA,
    Marketplace.N11,
  ];
  const statuses: OrderStatus[] = [
    OrderStatus.NEW,
    OrderStatus.PICKING,
    OrderStatus.SHIPPED,
    OrderStatus.DELIVERED,
    OrderStatus.DELIVERED,
    OrderStatus.DELIVERED,
  ];
  const buyerNames = [
    'Ahmet Yılmaz',
    'Fatma Kaya',
    'Mehmet Demir',
    'Ayşe Öztürk',
    'Mustafa Çelik',
    'Zeynep Arslan',
    'Emre Şahin',
    'Elif Yıldız',
  ];

  for (let i = 0; i < 30; i++) {
    const productRow = productData[i % productData.length];
    const platform = platforms[i % platforms.length];
    const status = statuses[i % statuses.length];
    const buyer = buyerNames[i % buyerNames.length];
    const daysAgo = i % 30;
    const quantity = (i % 3) + 1;
    const platformOrderId = `DEMO-ORDER-${String(i + 1).padStart(2, '0')}`;

    const orderCreatedAt = new Date(Date.now() - daysAgo * 86_400_000);
    const lineTotal = new Prisma.Decimal(productRow.salePrice).mul(
      new Prisma.Decimal(quantity),
    );

    await client.order.upsert({
      where: {
        organizationId_platform_platformOrderId: {
          organizationId: demoOrg.id,
          platform,
          platformOrderId,
        },
      },
      update: {
        status,
        customerName: buyer,
        totalAmount: lineTotal,
        platformCreatedAt: orderCreatedAt,
        deletedAt: null,
      },
      create: {
        organizationId: demoOrg.id,
        platformOrderId,
        platform,
        status,
        customerName: buyer,
        totalAmount: lineTotal,
        currency: 'TRY',
        platformCreatedAt: orderCreatedAt,
        createdAt: orderCreatedAt,
        items: {
          create: [
            {
              organizationId: demoOrg.id,
              barcode: productRow.barcode,
              sku: productRow.barcode,
              productName: productRow.name,
              quantity,
              unitPrice: new Prisma.Decimal(productRow.salePrice),
              platformItemId: `ITEM-${platformOrderId}`,
            },
          ],
        },
      },
    });
  }

  console.log(`Demo veri oluşturuldu: ${productData.length} ürün, 30 sipariş`);
  console.log('Demo giriş: demo@senkronize.com / demo123456');
}

async function main(): Promise<void> {
  await seedSuperAdminIfConfigured();
  await seedDemoData(prisma);
}

main()
  .catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
