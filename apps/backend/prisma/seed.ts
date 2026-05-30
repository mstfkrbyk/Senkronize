import { createCipheriv, randomBytes } from 'crypto';
import {
  AccountingMode,
  ErpType,
  InvoiceStatus,
  Marketplace,
  OrderStatus,
  OrgType,
  PartnerStatus,
  PlanTier,
  Prisma,
  PrismaClient,
  SubStatus,
  SyncFrequency,
  UserRole,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const PLATFORM_ORG_SLUG = 'senkronize-platform';

const SEED_DEMO = process.env.SEED_DEMO === 'true';
const DEMO_PASSWORD = 'demo123456';

/** Deneme partner bayi org (`partner@partner.com`) */
const PARTNER_DEMO_SLUG = 'demo-partner';
const PARTNER_DEMO_NAME = 'Senkronize Demo Partner';
const PARTNER_DEMO_EMAIL = 'partner@partner.com';
const PARTNER_DEMO_PASSWORD = 'Partner2026!';

/** Partner'ın bağlı demo müşteri org'u */
const PARTNER_CLIENT_DEMO_SLUG = 'demo-partner-musteri';

/** Partner'ın 2. demo müşteri org'u (INTEGRATION) */
const PARTNER_CLIENT_DEMO_2_SLUG = 'demo-partner-musteri-2';

/** BUNDLE + EXTERNAL_ERP — harici muhasebe (Paraşüt/BizimHesap) köprüsü demosu */
const DEMO_EXTERNAL_ERP_SLUG = 'demo-external-erp';
/** Örnek ErpConnection türü; BIZIMHESAP için erpType değiştirilebilir */
const DEMO_EXTERNAL_ERP_TYPE = ErpType.PARASUT;

type DemoProductRow = {
  barcode: string;
  name: string;
  category: string;
  brand: string;
  salePrice: number;
  stock: number;
};

type DemoOrgProfile = {
  slug: string;
  name: string;
  email: string;
  userName: string;
  productLines: Prisma.InputJsonValue;
  accountingMode: AccountingMode | null;
  metadata?: Prisma.InputJsonValue;
  /** Varsayılan: PRO deneme */
  plan?: PlanTier;
};

/** Ürün hattı JSON'unda BUNDLE veya tekil hat var mı */
function demoProfileHasProductLine(
  raw: Prisma.InputJsonValue,
  line: 'INTEGRATION' | 'ACCOUNTING',
): boolean {
  if (!Array.isArray(raw)) {
    return false;
  }
  for (const entry of raw) {
    const normalized = String(entry).trim().toUpperCase();
    if (normalized === 'BUNDLE') {
      return true;
    }
    if (normalized === line) {
      return true;
    }
  }
  return false;
}

function demoInvoicePrefix(profile: DemoOrgProfile): string | null {
  const meta = profile.metadata;
  if (meta == null || typeof meta !== 'object' || Array.isArray(meta)) {
    return null;
  }
  const prefix = (meta as { invoiceNumberPrefix?: unknown })
    .invoiceNumberPrefix;
  return typeof prefix === 'string' && prefix.length > 0 ? prefix : null;
}

function formatDemoAccountingMode(mode: AccountingMode | null): string {
  if (mode === AccountingMode.NATIVE) {
    return 'NATIVE';
  }
  if (mode === AccountingMode.EXTERNAL_ERP) {
    return 'EXTERNAL_ERP';
  }
  return '—';
}

/** SEED_DEMO örnek veri: entegrasyon sipariş sayısı ve önek */
const DEMO_INTEGRATION_SEED: Partial<
  Record<
    string,
    {
      orderCount: number;
      orderPrefix: string;
      useFullCatalog: boolean;
      platforms?: Marketplace[];
    }
  >
> = {
  'demo-entegrasyon': {
    orderCount: 30,
    orderPrefix: 'ENT',
    useFullCatalog: true,
  },
  'demo-hepsiburada': {
    orderCount: 24,
    orderPrefix: 'HB',
    useFullCatalog: true,
    platforms: [Marketplace.HEPSIBURADA],
  },
  'demo-paket': {
    orderCount: 12,
    orderPrefix: 'PKG',
    useFullCatalog: false,
  },
  [DEMO_EXTERNAL_ERP_SLUG]: {
    orderCount: 12,
    orderPrefix: 'HEX',
    useFullCatalog: false,
  },
};

const PARTNER_CLIENT_DEMO_PROFILE: DemoOrgProfile = {
  slug: PARTNER_CLIENT_DEMO_SLUG,
  name: 'Demo Partner A.Ş.',
  email: 'demo-partner-musteri@senkronize.com',
  userName: 'Demo Partner Müşteri',
  productLines: ['BUNDLE'],
  accountingMode: AccountingMode.NATIVE,
  metadata: {
    invoiceNumberPrefix: 'DPM',
    nextSequence: 1,
    invoiceNumberYear: 2026,
  },
};

const PARTNER_CLIENT_DEMO_2_PROFILE: DemoOrgProfile = {
  slug: PARTNER_CLIENT_DEMO_2_SLUG,
  name: 'Demo Mağaza İkinci',
  email: 'demo-magaza2@senkronize.com',
  userName: 'Demo Mağaza İkinci',
  productLines: ['INTEGRATION'],
  accountingMode: null,
  plan: PlanTier.GELISIM,
};

/**
 * Ürün hattı demo org'ları (her seed çalıştırmasında upsert).
 * Örnek veri yalnızca SEED_DEMO=true iken yüklenir.
 *
 * | slug             | productLines | accountingMode |
 * |------------------|--------------|----------------|
 * | demo-muhasebe    | ACCOUNTING   | NATIVE           |
 * | demo-entegrasyon | INTEGRATION  | —                |
 * | demo-paket         | BUNDLE       | NATIVE           |
 * | demo-external-erp  | BUNDLE       | EXTERNAL_ERP     |
 *
 * demo-external-erp: aktif ErpConnection stub (ENCRYPTION_KEY gerekir); aksi halde panelden bağlantı ekleyin.
 */
const DEMO_ORG_PROFILES: DemoOrgProfile[] = [
  {
    slug: 'demo-muhasebe',
    name: 'Demo Muhasebe Ltd.',
    email: 'demo-muhasebe@senkronize.com',
    userName: 'Demo Muhasebe',
    productLines: ['ACCOUNTING'],
    accountingMode: AccountingMode.NATIVE,
    metadata: {
      invoiceNumberPrefix: 'DMH',
      nextSequence: 1,
      invoiceNumberYear: 2026,
    },
  },
  {
    slug: 'demo-entegrasyon',
    name: 'Demo Entegrasyon A.Ş.',
    email: 'demo-entegrasyon@senkronize.com',
    userName: 'Demo Entegrasyon',
    productLines: ['INTEGRATION'],
    accountingMode: null,
  },
  {
    slug: 'demo-hepsiburada',
    name: 'Demo Hepsiburada Mağaza',
    email: 'demo-hepsiburada@senkronize.com',
    userName: 'Demo Hepsiburada',
    productLines: ['INTEGRATION'],
    accountingMode: null,
  },
  {
    slug: 'demo-paket',
    name: 'Demo Paket Mağaza',
    email: 'demo-paket@senkronize.com',
    userName: 'Demo Paket',
    productLines: ['BUNDLE'],
    accountingMode: AccountingMode.NATIVE,
    metadata: {
      invoiceNumberPrefix: 'DPK',
      nextSequence: 1,
      invoiceNumberYear: 2026,
    },
  },
  {
    slug: DEMO_EXTERNAL_ERP_SLUG,
    name: 'Demo Harici ERP Mağaza',
    email: 'demo-external-erp@senkronize.com',
    userName: 'Demo Harici ERP',
    productLines: ['BUNDLE'],
    accountingMode: AccountingMode.EXTERNAL_ERP,
  },
];

const DEMO_PRODUCTS: DemoProductRow[] = [
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

/** Partner 2. müşteri için hafif entegrasyon demo seti (SEED_DEMO) */
const PARTNER_CLIENT_2_LIGHT_PRODUCTS = DEMO_PRODUCTS.slice(0, 4);

type SeedInvoiceLine = {
  name: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  taxAmount: number;
  total: number;
};

function buildInvoiceLine(
  name: string,
  quantity: number,
  unitPrice: number,
  taxRate = 20,
): SeedInvoiceLine {
  const subtotal = unitPrice * quantity;
  const taxAmount = Math.round(subtotal * (taxRate / 100) * 100) / 100;
  const total = Math.round((subtotal + taxAmount) * 100) / 100;
  return { name, quantity, unitPrice, taxRate, taxAmount, total };
}

function encryptSeedCredentials(plaintext: string): string {
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
  return (
    iv.toString('hex') + authTag.toString('hex') + encrypted.toString('hex')
  );
}

function demoExternalErpStubCredentials(
  erpType: ErpType,
): Record<string, string> {
  if (erpType === ErpType.BIZIMHESAP) {
    return {
      apiKey: 'demo-bizimhesap-api-key',
      apiVersion: 'v2',
      defaultCustomerCode: 'DEMO-001',
    };
  }
  if (erpType === ErpType.PARASUT) {
    return {
      clientId: 'demo-parasut-client-id',
      clientSecret: 'demo-parasut-client-secret',
      companyId: 'demo-parasut-company-id',
    };
  }
  return { apiKey: 'demo-erp-stub' };
}

/**
 * Harici ERP demo org için örnek ErpConnection (+ varsayılan senkron ayarları).
 * ENCRYPTION_KEY yoksa bağlantı atlanır; org yine EXTERNAL_ERP kalır.
 */
async function seedDemoExternalErpConnection(
  client: PrismaClient,
  organizationId: string,
): Promise<void> {
  const hexKey = process.env.ENCRYPTION_KEY ?? '';
  if (!/^[0-9a-fA-F]{64}$/.test(hexKey)) {
    console.log(
      `  • ${DEMO_EXTERNAL_ERP_SLUG} — ErpConnection atlandı (ENCRYPTION_KEY yok); panelden ${DEMO_EXTERNAL_ERP_TYPE} veya BIZIMHESAP ekleyin`,
    );
    return;
  }

  const credentialsEnc = encryptSeedCredentials(
    JSON.stringify(demoExternalErpStubCredentials(DEMO_EXTERNAL_ERP_TYPE)),
  );
  const lastSyncAt = new Date(Date.now() - 2 * 3_600_000);

  const connection = await client.erpConnection.findFirst({
    where: {
      organizationId,
      erpType: DEMO_EXTERNAL_ERP_TYPE,
      deletedAt: null,
    },
  });

  const connectionData = {
    credentialsEnc,
    isActive: true,
    deletedAt: null as Date | null,
    syncErrorCount: 0,
    lastErrorAt: null as Date | null,
    lastErrorMessage: null as string | null,
    lastSyncAt,
    role: 'PRIMARY' as const,
  };

  const saved = connection
    ? await client.erpConnection.update({
        where: { id: connection.id },
        data: connectionData,
      })
    : await client.erpConnection.create({
        data: {
          organizationId,
          erpType: DEMO_EXTERNAL_ERP_TYPE,
          displayName: 'Demo ERP',
          ...connectionData,
        },
      });

  await client.erpSyncSettings.upsert({
    where: { erpConnectionId: saved.id },
    create: {
      organizationId,
      erpConnectionId: saved.id,
      syncFrequency: SyncFrequency.HOURLY,
      syncStock: true,
      syncProducts: true,
      syncInvoices: true,
      syncCustomers: true,
      autoCreateInvoice: false,
    },
    update: {
      syncFrequency: SyncFrequency.HOURLY,
      syncStock: true,
      syncProducts: true,
      syncInvoices: true,
      syncCustomers: true,
    },
  });

  await client.organization.update({
    where: { id: organizationId },
    data: { accountingMode: AccountingMode.EXTERNAL_ERP },
  });

  console.log(
    `  • ${DEMO_EXTERNAL_ERP_SLUG} — ErpConnection stub (${DEMO_EXTERNAL_ERP_TYPE}, demo kimlik bilgileri)`,
  );
}

function invoiceTotals(lines: SeedInvoiceLine[]): {
  subtotal: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  totalAmount: Prisma.Decimal;
} {
  const subtotalNum = lines.reduce(
    (sum, line) => sum + line.unitPrice * line.quantity,
    0,
  );
  const taxNum = lines.reduce((sum, line) => sum + line.taxAmount, 0);
  const totalNum = lines.reduce((sum, line) => sum + line.total, 0);
  return {
    subtotal: new Prisma.Decimal(Math.round(subtotalNum * 100) / 100),
    taxAmount: new Prisma.Decimal(Math.round(taxNum * 100) / 100),
    totalAmount: new Prisma.Decimal(Math.round(totalNum * 100) / 100),
  };
}

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
    const platformMetadata = {
      internalAccount: true,
      billingExempt: true,
    } as Prisma.InputJsonValue;

    if (!org) {
      org = await tx.organization.create({
        data: {
          slug: PLATFORM_ORG_SLUG,
          name: 'Senkronize Platform',
          type: OrgType.DIRECT,
          onboardingCompleted: true,
          metadata: platformMetadata,
        },
      });
      await tx.subscription.create({
        data: {
          organizationId: org.id,
          plan: PlanTier.KURUMSAL,
          status: SubStatus.ACTIVE,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          nextBillingAt: null,
          monthlyOrderLimit: null,
          marketplaceLimit: null,
          ecommerceLimit: null,
          erpLimit: null,
          userLimit: null,
        },
      });
    } else {
      org = await tx.organization.update({
        where: { id: org.id },
        data: { metadata: platformMetadata },
      });
      await tx.subscription.upsert({
        where: { organizationId: org.id },
        create: {
          organizationId: org.id,
          plan: PlanTier.KURUMSAL,
          status: SubStatus.ACTIVE,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          nextBillingAt: null,
          monthlyOrderLimit: null,
          marketplaceLimit: null,
          ecommerceLimit: null,
          erpLimit: null,
          userLimit: null,
        },
        update: {
          plan: PlanTier.KURUMSAL,
          status: SubStatus.ACTIVE,
          trialEndsAt: null,
          nextBillingAt: null,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          monthlyOrderLimit: null,
          marketplaceLimit: null,
          ecommerceLimit: null,
          erpLimit: null,
          userLimit: null,
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

async function ensureDemoOrg(
  client: PrismaClient,
  profile: DemoOrgProfile,
): Promise<{ id: string }> {
  const org = await client.organization.upsert({
    where: { slug: profile.slug },
    update: {
      name: profile.name,
      type: OrgType.DIRECT,
      onboardingCompleted: true,
      productLines: profile.productLines,
      accountingMode: profile.accountingMode,
      ...(profile.metadata != null ? { metadata: profile.metadata } : {}),
      deletedAt: null,
    },
    create: {
      name: profile.name,
      slug: profile.slug,
      type: OrgType.DIRECT,
      onboardingCompleted: true,
      productLines: profile.productLines,
      accountingMode: profile.accountingMode,
      ...(profile.metadata != null ? { metadata: profile.metadata } : {}),
    },
  });

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  await client.user.upsert({
    where: { email: profile.email },
    update: {
      name: profile.userName,
      passwordHash,
      role: UserRole.OWNER,
      organizationId: org.id,
      deletedAt: null,
    },
    create: {
      email: profile.email,
      name: profile.userName,
      passwordHash,
      role: UserRole.OWNER,
      organizationId: org.id,
    },
  });

  const now = new Date();
  const trialEndsAt = new Date(Date.now() + 14 * 86_400_000);
  const plan = profile.plan ?? PlanTier.PRO;
  await client.subscription.upsert({
    where: { organizationId: org.id },
    update: {
      plan,
      status: SubStatus.TRIAL,
      trialEndsAt,
      currentPeriodStart: now,
      currentPeriodEnd: trialEndsAt,
    },
    create: {
      organizationId: org.id,
      plan,
      status: SubStatus.TRIAL,
      trialEndsAt,
      currentPeriodStart: now,
      currentPeriodEnd: trialEndsAt,
    },
  });

  return { id: org.id };
}

async function seedIntegrationCatalog(
  client: PrismaClient,
  organizationId: string,
  productRows: DemoProductRow[],
): Promise<void> {
  for (const p of productRows) {
    const product = await client.product.upsert({
      where: {
        organizationId_barcode: { organizationId, barcode: p.barcode },
      },
      update: {
        name: p.name,
        category: p.category,
        brand: p.brand,
        deletedAt: null,
      },
      create: {
        organizationId,
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
          organizationId,
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
        organizationId,
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
}

async function seedIntegrationOrders(
  client: PrismaClient,
  organizationId: string,
  productRows: DemoProductRow[],
  orderCount: number,
  idPrefix: string,
  platforms: Marketplace[] = [
    Marketplace.TRENDYOL,
    Marketplace.HEPSIBURADA,
    Marketplace.N11,
  ],
): Promise<void> {
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

  for (let i = 0; i < orderCount; i++) {
    const productRow = productRows[i % productRows.length];
    const platform = platforms[i % platforms.length];
    const status = statuses[i % statuses.length];
    const buyer = buyerNames[i % buyerNames.length];
    const daysAgo = i % 30;
    const quantity = (i % 3) + 1;
    const platformOrderId = `${idPrefix}-ORDER-${String(i + 1).padStart(2, '0')}`;

    const orderCreatedAt = new Date(Date.now() - daysAgo * 86_400_000);
    const lineTotal = new Prisma.Decimal(productRow.salePrice).mul(
      new Prisma.Decimal(quantity),
    );

    await client.order.upsert({
      where: {
        organizationId_platform_platformOrderId: {
          organizationId,
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
        organizationId,
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
              organizationId,
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
}

async function seedAccountingSamples(
  client: PrismaClient,
  organizationId: string,
  invoicePrefix: string,
): Promise<void> {
  const customers = [
    {
      externalId: 'CUST-001',
      name: 'Atlas Yazılım A.Ş.',
      email: 'muhasebe@atlas.example',
      phone: '+90 212 555 0101',
      city: 'İstanbul',
      totalOrders: 12,
      totalSpent: 48500,
    },
    {
      externalId: 'CUST-002',
      name: 'Nova Perakende Ltd.',
      email: 'finans@nova.example',
      phone: '+90 216 555 0202',
      city: 'İstanbul',
      totalOrders: 7,
      totalSpent: 22100,
    },
    {
      externalId: 'CUST-003',
      name: 'Delta Lojistik',
      email: 'iletisim@delta.example',
      phone: '+90 312 555 0303',
      city: 'Ankara',
      totalOrders: 4,
      totalSpent: 9800,
    },
    {
      externalId: 'CUST-004',
      name: 'Beta Tekstil',
      email: 'satis@beta.example',
      phone: '+90 232 555 0404',
      city: 'İzmir',
      totalOrders: 9,
      totalSpent: 31200,
    },
    {
      externalId: 'CUST-005',
      name: 'Gamma Gıda San.',
      email: 'info@gamma.example',
      phone: '+90 224 555 0505',
      city: 'Bursa',
      totalOrders: 2,
      totalSpent: 4500,
    },
  ];

  for (const c of customers) {
    const existing = await client.customer.findFirst({
      where: {
        organizationId,
        externalId: c.externalId,
        deletedAt: null,
      },
    });
    const data = {
      name: c.name,
      email: c.email,
      phone: c.phone,
      city: c.city,
      totalOrders: c.totalOrders,
      totalSpent: new Prisma.Decimal(c.totalSpent),
      deletedAt: null,
    };
    if (existing) {
      await client.customer.update({
        where: { id: existing.id },
        data,
      });
    } else {
      await client.customer.create({
        data: {
          organizationId,
          externalId: c.externalId,
          ...data,
        },
      });
    }
  }

  const invoiceYear = 2026;
  const invoiceSpecs: Array<{
    number: string;
    customerName: string;
    status: InvoiceStatus;
    lines: SeedInvoiceLine[];
  }> = [
    {
      number: `${invoicePrefix}-${invoiceYear}-000001`,
      customerName: 'Atlas Yazılım A.Ş.',
      status: InvoiceStatus.PAID,
      lines: [buildInvoiceLine('Danışmanlık hizmeti', 1, 12000)],
    },
    {
      number: `${invoicePrefix}-${invoiceYear}-000002`,
      customerName: 'Nova Perakende Ltd.',
      status: InvoiceStatus.SENT,
      lines: [buildInvoiceLine('Entegrasyon kurulumu', 1, 8500)],
    },
    {
      number: `${invoicePrefix}-${invoiceYear}-000003`,
      customerName: 'Delta Lojistik',
      status: InvoiceStatus.OVERDUE,
      lines: [buildInvoiceLine('Aylık abonelik', 3, 2400)],
    },
    {
      number: `${invoicePrefix}-${invoiceYear}-000004`,
      customerName: 'Beta Tekstil',
      status: InvoiceStatus.DRAFT,
      lines: [
        buildInvoiceLine('Stok senkronizasyon modülü', 1, 15000),
        buildInvoiceLine('Eğitim paketi', 2, 3500),
      ],
    },
    {
      number: `${invoicePrefix}-${invoiceYear}-000005`,
      customerName: 'Gamma Gıda San.',
      status: InvoiceStatus.PAID,
      lines: [buildInvoiceLine('Destek sözleşmesi', 12, 750)],
    },
    {
      number: `${invoicePrefix}-${invoiceYear}-000006`,
      customerName: 'Atlas Yazılım A.Ş.',
      status: InvoiceStatus.SENT,
      lines: [buildInvoiceLine('Ek kullanıcı lisansı', 5, 990)],
    },
    {
      number: `${invoicePrefix}-${invoiceYear}-000007`,
      customerName: 'Nova Perakende Ltd.',
      status: InvoiceStatus.PAID,
      lines: [buildInvoiceLine('Raporlama modülü', 1, 6200)],
    },
    {
      number: `${invoicePrefix}-${invoiceYear}-000008`,
      customerName: 'Beta Tekstil',
      status: InvoiceStatus.OVERDUE,
      lines: [buildInvoiceLine('API kullanım ücreti', 1, 4100)],
    },
  ];

  for (const spec of invoiceSpecs) {
    const totals = invoiceTotals(spec.lines);
    await client.invoice.upsert({
      where: {
        organizationId_invoiceNumber: {
          organizationId,
          invoiceNumber: spec.number,
        },
      },
      update: {
        customerName: spec.customerName,
        items: spec.lines,
        subtotal: totals.subtotal,
        taxAmount: totals.taxAmount,
        totalAmount: totals.totalAmount,
        status: spec.status,
        invoiceYear,
        deletedAt: null,
      },
      create: {
        organizationId,
        invoiceNumber: spec.number,
        invoiceYear,
        customerName: spec.customerName,
        items: spec.lines,
        subtotal: totals.subtotal,
        taxAmount: totals.taxAmount,
        taxRate: 20,
        totalAmount: totals.totalAmount,
        status: spec.status,
      },
    });
  }

  await client.organization.update({
    where: { id: organizationId },
    data: {
      metadata: {
        invoiceNumberPrefix: invoicePrefix,
        nextSequence: invoiceSpecs.length + 1,
        invoiceNumberYear: invoiceYear,
      },
    },
  });
}

async function ensurePartnerClientRelationship(
  client: PrismaClient,
  partnerOrgId: string,
  clientOrgId: string,
  commissionRate: Prisma.Decimal,
  acceptedAt: Date,
): Promise<void> {
  await client.partnerRelationship.upsert({
    where: {
      partnerOrgId_clientOrgId: {
        partnerOrgId,
        clientOrgId,
      },
    },
    update: {
      status: PartnerStatus.ACTIVE,
      commissionPct: commissionRate,
      canImpersonate: true,
      acceptedAt,
      invitedEmail: null,
      inviteToken: null,
      inviteExpiresAt: null,
    },
    create: {
      partnerOrgId,
      clientOrgId,
      status: PartnerStatus.ACTIVE,
      commissionPct: commissionRate,
      canImpersonate: true,
      acceptedAt,
    },
  });
}

async function seedPartnerDemo(client: PrismaClient): Promise<void> {
  const passwordHash = await bcrypt.hash(PARTNER_DEMO_PASSWORD, 10);
  const now = new Date();
  const trialEndsAt = new Date(Date.now() + 14 * 86_400_000);
  const commissionRate = new Prisma.Decimal(10);

  const partnerOrg = await client.organization.upsert({
    where: { slug: PARTNER_DEMO_SLUG },
    update: {
      name: PARTNER_DEMO_NAME,
      type: OrgType.PARTNER,
      onboardingCompleted: true,
      productLines: ['BUNDLE'],
      deletedAt: null,
    },
    create: {
      slug: PARTNER_DEMO_SLUG,
      name: PARTNER_DEMO_NAME,
      type: OrgType.PARTNER,
      onboardingCompleted: true,
      productLines: ['BUNDLE'],
    },
  });

  await client.partnerProfile.upsert({
    where: { organizationId: partnerOrg.id },
    update: { commissionRate },
    create: {
      organizationId: partnerOrg.id,
      commissionRate,
    },
  });

  await client.user.upsert({
    where: { email: PARTNER_DEMO_EMAIL },
    update: {
      name: 'Demo Partner',
      passwordHash,
      role: UserRole.OWNER,
      organizationId: partnerOrg.id,
      deletedAt: null,
    },
    create: {
      email: PARTNER_DEMO_EMAIL,
      name: 'Demo Partner',
      passwordHash,
      role: UserRole.OWNER,
      organizationId: partnerOrg.id,
    },
  });

  await client.subscription.upsert({
    where: { organizationId: partnerOrg.id },
    update: {
      plan: PlanTier.GELISIM,
      status: SubStatus.TRIAL,
      trialEndsAt,
      currentPeriodStart: now,
      currentPeriodEnd: trialEndsAt,
    },
    create: {
      organizationId: partnerOrg.id,
      plan: PlanTier.GELISIM,
      status: SubStatus.TRIAL,
      trialEndsAt,
      currentPeriodStart: now,
      currentPeriodEnd: trialEndsAt,
    },
  });

  const { id: clientOrgId } = await ensureDemoOrg(
    client,
    PARTNER_CLIENT_DEMO_PROFILE,
  );
  const { id: client2OrgId } = await ensureDemoOrg(
    client,
    PARTNER_CLIENT_DEMO_2_PROFILE,
  );

  await ensurePartnerClientRelationship(
    client,
    partnerOrg.id,
    clientOrgId,
    commissionRate,
    now,
  );
  await ensurePartnerClientRelationship(
    client,
    partnerOrg.id,
    client2OrgId,
    commissionRate,
    now,
  );

  console.log('Deneme partner (bayi) ve müşteriler:');
  console.log(
    `  • ${PARTNER_DEMO_SLUG} — ${PARTNER_DEMO_NAME} (PARTNER, Gelişim deneme)`,
  );
  console.log(`    Giriş: ${PARTNER_DEMO_EMAIL}`);
  console.log(
    `  • ${PARTNER_CLIENT_DEMO_SLUG} — ${PARTNER_CLIENT_DEMO_PROFILE.name} (DIRECT müşteri, BUNDLE NATIVE, PRO deneme)`,
  );
  console.log(
    `    Giriş: ${PARTNER_CLIENT_DEMO_PROFILE.email} / ${DEMO_PASSWORD}`,
  );
  console.log(
    `  • ${PARTNER_CLIENT_DEMO_2_SLUG} — ${PARTNER_CLIENT_DEMO_2_PROFILE.name} (DIRECT müşteri, Gelişim deneme, INTEGRATION)`,
  );
  console.log(
    `    Giriş: ${PARTNER_CLIENT_DEMO_2_PROFILE.email} / ${DEMO_PASSWORD}`,
  );
  console.log(
    `  • PartnerRelationship ACTIVE (${PARTNER_DEMO_SLUG} → ${PARTNER_CLIENT_DEMO_SLUG} + ${PARTNER_CLIENT_DEMO_2_SLUG}, komisyon %10, impersonate)`,
  );
  if (SEED_DEMO) {
    console.log(
      `  • ${PARTNER_CLIENT_DEMO_SLUG} entegrasyon + muhasebe demo verisi SEED_DEMO ile yüklenecek`,
    );
    console.log(
      `  • ${PARTNER_CLIENT_DEMO_2_SLUG} hafif entegrasyon demo verisi SEED_DEMO ile yüklenecek`,
    );
  }
}

async function seedDemoOrganizations(
  client: PrismaClient,
): Promise<Record<string, string>> {
  const orgIds: Record<string, string> = {};
  for (const profile of DEMO_ORG_PROFILES) {
    const { id } = await ensureDemoOrg(client, profile);
    orgIds[profile.slug] = id;
  }

  console.log(
    `Demo organizasyonlar (${DEMO_ORG_PROFILES.length} ürün hattı + harici ERP):`,
  );
  for (const profile of DEMO_ORG_PROFILES) {
    const rawLines = profile.productLines;
    const isBundle =
      Array.isArray(rawLines) &&
      rawLines.some((entry) => String(entry).toUpperCase() === 'BUNDLE');
    const lines = isBundle
      ? 'BUNDLE (INTEGRATION + ACCOUNTING)'
      : JSON.stringify(rawLines);
    console.log(
      `  • ${profile.slug} — ${lines}, accountingMode=${formatDemoAccountingMode(profile.accountingMode)}`,
    );
    console.log(`    Giriş: ${profile.email} / ${DEMO_PASSWORD}`);
  }

  const externalErpOrgId = orgIds[DEMO_EXTERNAL_ERP_SLUG];
  if (externalErpOrgId) {
    await seedDemoExternalErpConnection(client, externalErpOrgId);
  }

  return orgIds;
}

async function seedDemoSampleData(
  client: PrismaClient,
  orgIds: Record<string, string>,
): Promise<void> {
  if (!SEED_DEMO) {
    console.log(
      'SEED_DEMO=false; demo org hesapları oluşturuldu, örnek ürün/sipariş/fatura verisi atlandı.',
    );
    return;
  }

  console.log('Demo örnek veri yükleniyor (SEED_DEMO=true)...');

  const fullCatalog = DEMO_PRODUCTS;
  const bundleCatalog = DEMO_PRODUCTS.slice(0, 8);

  for (const profile of DEMO_ORG_PROFILES) {
    const orgId = orgIds[profile.slug];
    if (!orgId) {
      continue;
    }

    const integrationSeed = DEMO_INTEGRATION_SEED[profile.slug];
    if (
      demoProfileHasProductLine(profile.productLines, 'INTEGRATION') &&
      integrationSeed
    ) {
      const products = integrationSeed.useFullCatalog
        ? fullCatalog
        : bundleCatalog;
      await seedIntegrationCatalog(client, orgId, products);
      await seedIntegrationOrders(
        client,
        orgId,
        products,
        integrationSeed.orderCount,
        integrationSeed.orderPrefix,
        integrationSeed.platforms,
      );
    }

    const invoicePrefix = demoInvoicePrefix(profile);
    if (
      demoProfileHasProductLine(profile.productLines, 'ACCOUNTING') &&
      invoicePrefix
    ) {
      await seedAccountingSamples(client, orgId, invoicePrefix);
    }
  }

  const partnerClient = await client.organization.findFirst({
    where: { slug: PARTNER_CLIENT_DEMO_SLUG, deletedAt: null },
    select: { id: true },
  });
  if (partnerClient) {
    await seedIntegrationCatalog(client, partnerClient.id, bundleCatalog);
    await seedIntegrationOrders(
      client,
      partnerClient.id,
      bundleCatalog,
      8,
      'DPM',
    );
    await seedAccountingSamples(client, partnerClient.id, 'DPM');
    console.log(
      `  • ${PARTNER_CLIENT_DEMO_SLUG} — ${bundleCatalog.length} ürün, 8 sipariş, muhasebe örnekleri (DPM)`,
    );
  }

  const partnerClient2 = await client.organization.findFirst({
    where: { slug: PARTNER_CLIENT_DEMO_2_SLUG, deletedAt: null },
    select: { id: true },
  });
  if (partnerClient2) {
    await seedIntegrationCatalog(
      client,
      partnerClient2.id,
      PARTNER_CLIENT_2_LIGHT_PRODUCTS,
    );
    await seedIntegrationOrders(
      client,
      partnerClient2.id,
      PARTNER_CLIENT_2_LIGHT_PRODUCTS,
      3,
      'DPM2',
    );
    console.log(
      `  • ${PARTNER_CLIENT_DEMO_2_SLUG} — ${PARTNER_CLIENT_2_LIGHT_PRODUCTS.length} ürün, 3 sipariş (DPM2)`,
    );
  }
}

async function main(): Promise<void> {
  await seedSuperAdminIfConfigured();
  await seedPartnerDemo(prisma);
  const demoOrgIds = await seedDemoOrganizations(prisma);
  await seedDemoSampleData(prisma, demoOrgIds);
}

main()
  .catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
