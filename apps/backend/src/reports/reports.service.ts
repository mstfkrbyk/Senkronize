import { Injectable } from '@nestjs/common';
import { Marketplace, OrderStatus, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

import { readThroughCache } from '../common/cache/cache.decorator';
import { CacheKeys } from '../common/cache/cache-keys';
import { CacheService } from '../common/cache/cache.service';
import { CurrencyService } from '../currency/currency.service';
import { PrismaService } from '../prisma/prisma.service';

import type {
  DashboardSummaryDto,
  OrderTrendDto,
  PlatformComparisonDto,
  PlatformComparisonRowDto,
  PlatformReportRow,
  ProfitReportDto,
  SalesReportRow,
  StockMovementRow,
  StockValueReportDto,
  TopProductRow,
} from './reports.types';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** UTC — Pazartesi başlangıcına göre hafta anahtarı (YYYY-MM-DD). */
function periodKeyUtc(
  date: Date,
  groupBy: 'day' | 'week' | 'month',
): string {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  const day = date.getUTCDate();
  if (groupBy === 'day') {
    return `${y}-${pad2(m + 1)}-${pad2(day)}`;
  }
  if (groupBy === 'month') {
    return `${y}-${pad2(m + 1)}`;
  }
  const jd = Date.UTC(y, m, day);
  const dow = date.getUTCDay();
  const mondayOffset = (dow + 6) % 7;
  const monMs = jd - mondayOffset * 86_400_000;
  const mon = new Date(monMs);
  return `${mon.getUTCFullYear()}-${pad2(mon.getUTCMonth() + 1)}-${pad2(mon.getUTCDate())}`;
}

export const MARKETPLACE_LABEL_TR: Partial<Record<Marketplace, string>> = {
  [Marketplace.TRENDYOL]: 'Trendyol',
  [Marketplace.HEPSIBURADA]: 'Hepsiburada',
  [Marketplace.N11]: 'n11',
  [Marketplace.AMAZON_TR]: 'Amazon TR',
  [Marketplace.CICEKSEPETI]: 'Çiçeksepeti',
  [Marketplace.IDEASOFT]: 'Ideasoft',
  [Marketplace.PTTAVM]: 'PttAVM',
  [Marketplace.PAZARAMA]: 'Pazarama',
  [Marketplace.TSOFT]: 'T-Soft',
  [Marketplace.TICIMAX]: 'Ticimax',
  [Marketplace.WOOCOMMERCE]: 'WooCommerce',
  [Marketplace.SHOPIFY]: 'Shopify',
  [Marketplace.GETIR]: 'Getir',
  [Marketplace.GRATIS]: 'Gratis',
  [Marketplace.BOYNER]: 'Boyner',
  [Marketplace.MORHIPO]: 'Morhipo',
  [Marketplace.DOLAP]: 'Dolap',
  [Marketplace.EBAY]: 'eBay',
  [Marketplace.ETSY]: 'Etsy',
  [Marketplace.TEMU]: 'Temu',
  [Marketplace.SAHIBINDEN]: 'Sahibinden',
  [Marketplace.MIGROS]: 'Migros Sanal Market',
  [Marketplace.HEPSIEXPRESS]: 'Hepsiexpress',
  [Marketplace.FLO]: 'Flo',
  [Marketplace.DEFACTO]: 'Defacto',
  [Marketplace.LCWAIKIKI]: 'LC Waikiki',
  [Marketplace.VATAN]: 'Vatan Bilgisayar',
  [Marketplace.MEDIAMARKT]: 'MediaMarkt TR',
  [Marketplace.TEKNOSA]: 'Teknosa',
  [Marketplace.KOTON]: 'Koton',
  [Marketplace.MAVI]: 'Mavi',
  [Marketplace.ALLEGRO]: 'Allegro',
  [Marketplace.WILDBERRIES]: 'Wildberries',
  [Marketplace.OZON]: 'Ozon',
  [Marketplace.NOON]: 'Noon',
  [Marketplace.AMAZON_EU]: 'Amazon Avrupa',
  [Marketplace.CDISCOUNT]: 'Cdiscount',
  [Marketplace.KAUFLAND]: 'Kaufland',
  [Marketplace.TRENDYOL_GO]: 'Trendyol GO',
  [Marketplace.BANABI]: 'Banabi',
  [Marketplace.A101]: 'A101 Online',
  [Marketplace.ELEKTRA]: 'Elektra',
  [Marketplace.ARCELIK]: 'Arçelik D2C',
  [Marketplace.VESTEL]: 'Vestel D2C',
  [Marketplace.BIMAKILLI]: 'Bim Akıllı',
  [Marketplace.MIGROSHEMEN]: 'Migros Hemen',
  [Marketplace.ROBOMARKT]: 'Robomarkt',
  [Marketplace.SHOPIGO]: 'Shopigo',
  [Marketplace.YEMEKSEPETI]: 'Yemeksepeti Market',
  [Marketplace.GETIR_FOOD]: 'Getir Yemek',
  [Marketplace.TRENDYOL_YEMEK]: 'Trendyol Yemek',
  [Marketplace.FUUDY]: 'Fuudy',
  [Marketplace.MODANISA]: 'Modanisa',
  [Marketplace.SEFAMERVE]: 'Sefamerve',
  [Marketplace.LIDYANA]: 'Lidyana',
  [Marketplace.ADDAX]: 'Addax',
  [Marketplace.VIVENSE]: 'Vivense',
  [Marketplace.CICEKSEPETI_EV]: 'Çiçeksepeti Ev',
  [Marketplace.EVIDEA]: 'Evidea',
  [Marketplace.PORLAND]: 'Porland',
  [Marketplace.ALIBABA]: 'Alibaba.com',
  [Marketplace.MADEINCHINA]: 'Made-in-China',
  [Marketplace.EXPORTIFY]: 'Exportify',
  [Marketplace.GITTIGIDIYOR]: 'GittiGidiyor (arşiv)',
  [Marketplace.KITAPYURDU]: 'Kitapyurdu',
  [Marketplace.DR]: 'D&R',
  [Marketplace.SPORTIVE]: 'Sportive',
  [Marketplace.ENPARA]: 'Enpara Alışveriş',
  [Marketplace.LAZADA]: 'Lazada',
  [Marketplace.SHOPEE]: 'Shopee',
  [Marketplace.TOKOPEDIA]: 'Tokopedia',
  [Marketplace.MEESHO]: 'Meesho',
  [Marketplace.OTTO]: 'Otto Market',
  [Marketplace.ZALANDO]: 'Zalando',
  [Marketplace.BOLCOM]: 'Bol.com',
  [Marketplace.EMAG]: 'eMAG',
  [Marketplace.IDEALO]: 'Idealo',
  [Marketplace.REALDE]: 'Real.de',
  [Marketplace.ZARA]: 'Zara Online',
  [Marketplace.DECATHLON]: 'Decathlon TR',
  [Marketplace.HEPSIBURADA_PREMIUM]: 'Hepsiburada Premium',
  [Marketplace.TRENDYOL_PREMIUM]: 'Trendyol Premium',
  [Marketplace.PAZARAMA_PREMIUM]: 'Pazarama Premium',
  [Marketplace.N11_PRO]: 'N11 Pro',
  [Marketplace.AMAZON_AE]: 'Amazon UAE',
  [Marketplace.NAMSHI]: 'Namshi',
  [Marketplace.CARREFOUR_ME]: 'Carrefour ME',
  [Marketplace.JUMIA]: 'Jumia',
  [Marketplace.DARAZ]: 'Daraz',
  [Marketplace.FLIPKART]: 'Flipkart',
  [Marketplace.SNAPDEAL]: 'Snapdeal',
  [Marketplace.MYNTRA]: 'Myntra',
  [Marketplace.RAKUTEN]: 'Rakuten',
  [Marketplace.QOO10]: 'Qoo10',
  [Marketplace.LAZADA_PH]: 'Lazada PH',
  [Marketplace.MERCADOLIBRE]: 'Mercado Libre',
  [Marketplace.GETIR_YEMEK]: 'Getir Yemek (Partner API)',
  [Marketplace.LETGO]: 'Letgo / OLX TR',
  [Marketplace.SAHIBINDEN_PRO]: 'Sahibinden Pro',
  [Marketplace.SHOPIVERSE]: 'Shopiverse',
  [Marketplace.WALMART]: 'Walmart Marketplace',
  [Marketplace.TARGET_PLUS]: 'Target Plus',
  [Marketplace.BESTBUY]: 'Best Buy Marketplace',
  [Marketplace.WAYFAIR]: 'Wayfair',
  [Marketplace.OVERSTOCK]: 'Overstock',
  [Marketplace.FNAC]: 'Fnac Marketplace',
  [Marketplace.LAREDOUTE]: 'La Redoute',
  [Marketplace.SPARTOO]: 'Spartoo',
  [Marketplace.MANOMANO]: 'ManoMano',
  [Marketplace.VEEPEE]: 'Veepee',
  [Marketplace.TRENDYOL_INT]: 'Trendyol International',
  [Marketplace.MIGROS_SANAL]: 'Migros Sanal Market',
  [Marketplace.CARREFOURSA]: 'CarrefourSA Online',
  [Marketplace.BIM_ONLINE]: 'BIM Online',
  [Marketplace.SOK_MARKET]: 'ŞOK Market Online',
  [Marketplace.TAZE_DIREKT]: 'Taze Direkt',
  [Marketplace.GORILLAS]: 'Gorillas',
  [Marketplace.INSTACART]: 'Instacart Connect',
  [Marketplace.ALIBABA_TR]: 'Alibaba TR (1688)',
  [Marketplace.TRENDYOL_MILLA]: 'Trendyol Milla',
  [Marketplace.SAHIBINDEN_PREMIUM]: 'Sahibinden Premium',
  [Marketplace.BUKALAPAK]: 'Bukalapak',
  [Marketplace.JDID]: 'JD.ID',
  [Marketplace.BLIBLI]: 'Blibli',
  [Marketplace.TIKI]: 'Tiki',
  [Marketplace.SENDO]: 'Sendo',
  [Marketplace.CATCH_AU]: 'Catch.com.au',
  [Marketplace.MYDEAL]: 'MyDeal',
  [Marketplace.TRADEME]: 'Trade Me',
  [Marketplace.LAMODA]: 'Lamoda',
  [Marketplace.YANDEX_MARKET]: 'Yandex Market',
  [Marketplace.MALL_CZ]: 'Mall.cz',
  [Marketplace.PIGU]: 'Pigu.lt',
  [Marketplace.PRICERUNNER]: 'Pricerunner',
  [Marketplace.OUNASS]: 'Ounass',
  [Marketplace.SIVVI]: 'Sivvi',
  [Marketplace.IDEFIX]: 'Idefix',
  [Marketplace.PAZAR365]: 'Pazar365',
  [Marketplace.DOPING]: 'Doping Hafıza',
  [Marketplace.YARGICI]: 'Yargıcı',
  [Marketplace.ADIDAS_TR]: 'Adidas TR',
  [Marketplace.ZARA_TR]: 'Zara TR',
  [Marketplace.TIKTOK_SHOP]: 'TikTok Shop',
  [Marketplace.PINTEREST]: 'Pinterest Shopping',
  [Marketplace.INSTAGRAM_SHOP]: 'Instagram Shopping',
  [Marketplace.YOUTUBE_SHOP]: 'YouTube Shopping',
  [Marketplace.SNAPCHAT_STORE]: 'Snapchat Store',
  [Marketplace.WHATSAPP_COMMERCE]: 'WhatsApp Business',
  [Marketplace.CARREFOUR_FR]: 'Carrefour FR',
  [Marketplace.CASINO_FR]: 'Casino FR',
  [Marketplace.LIDL]: 'Lidl Plus',
  [Marketplace.ALDI]: 'Aldi',
  [Marketplace.SHOPBACK]: 'Shopback',
  [Marketplace.COUPANG]: 'Coupang',
  [Marketplace.STREET11]: '11Street KR',
  [Marketplace.BULDUMBULDUM]: 'Buldumbuldum',
  [Marketplace.ALISVERIS_COM]: 'Alışveriş.com',
  [Marketplace.CDON]: 'CDON',
  [Marketplace.ELLOS]: 'Ellos',
  [Marketplace.DUSTIN]: 'Dustin',
  [Marketplace.KOMPLETT]: 'Komplett',
  [Marketplace.POWER_DK]: 'Power.dk',
  [Marketplace.CENEO]: 'Ceneo',
  [Marketplace.HEUREKA]: 'Heureka',
  [Marketplace.OLX]: 'OLX',
  [Marketplace.MUMZWORLD]: 'Mumzworld',
  [Marketplace.BOUTIQAAT]: 'Boutiqaat',
  [Marketplace.AWOK]: 'Awok',
  [Marketplace.SHUKRAN]: 'Shukran',
  [Marketplace.BRANDS4LESS]: 'Brands4Less',
  [Marketplace.HARAJ]: 'Haraj',
  [Marketplace.ZANDO]: 'Zando',
  [Marketplace.MEQASA]: 'Meqasa',
  [Marketplace.VENDTEK]: 'Vendtek',
  [Marketplace.SHOPANDSEND]: 'Shopandsend',
  [Marketplace.WADI]: 'Wadi',
  [Marketplace.TAKEALOT]: 'Takealot',
  [Marketplace.KILIMALL]: 'Kilimall',
  [Marketplace.BIDORBUY]: 'Bidorbuy',
  [Marketplace.ALIBABA_B2B]: 'Alibaba B2B (1688)',
  [Marketplace.GLOBAL_SOURCES]: 'Global Sources',
  [Marketplace.DHGATE]: 'DHgate',
  [Marketplace.INDIAMART]: 'IndiaMart',
  [Marketplace.TRADEINDIA]: 'TradeIndia',
  [Marketplace.EC21]: 'EC21',
  [Marketplace.TEDARIKCI]: 'Tedarikçi.com',
  [Marketplace.BUYUK_MAGAZA]: 'Büyük Mağaza',
  [Marketplace.TOPTANEVI]: 'Toptanevi',
  [Marketplace.SAHIBINDEN_B2B]: 'Sahibinden B2B',
  [Marketplace.SPOCKET]: 'Spocket',
  [Marketplace.OBERLO]: 'Oberlo',
  [Marketplace.AUTODS]: 'AutoDS',
  [Marketplace.DOBA]: 'Doba',
  [Marketplace.CULT_BEAUTY]: 'Cult Beauty',
  [Marketplace.LOOKFANTASTIC]: 'Lookfantastic',
  [Marketplace.NOTINO]: 'Notino',
  [Marketplace.IHERB]: 'iHerb',
  [Marketplace.VITACOST]: 'Vitacost',
  [Marketplace.HELLOFRESH]: 'HelloFresh',
  [Marketplace.DELIVEROO]: 'Deliveroo',
  [Marketplace.UBER_EATS]: 'Uber Eats',
  [Marketplace.ROSSMANN_TR]: 'Rossmann TR',
  [Marketplace.TRENDYOL_GROCERIES]: 'Trendyol Groceries',
  [Marketplace.AUTOTRADER]: 'AutoTrader',
  [Marketplace.EBAY_MOTORS]: 'eBay Motors',
  [Marketplace.WEBMOTORS]: 'Webmotors',
  [Marketplace.ARACIM]: 'Aracım.com',
  [Marketplace.OTOPLAZA]: 'OtoPlaza',
  [Marketplace.BACKMARKET]: 'Back Market',
  [Marketplace.SWAPPA]: 'Swappa',
  [Marketplace.DECLUTTR]: 'Decluttr',
  [Marketplace.CATAWIKI]: 'Catawiki',
  [Marketplace.FIRSTDIBS]: '1stDibs',
  [Marketplace.ARSY]: 'Artsy',
  [Marketplace.CHAIRISH]: 'Chairish',
  [Marketplace.MODACRUZ]: 'Modacruz',
  [Marketplace.PINKTROTTERS]: 'Pinktrotters',
  [Marketplace.G2A]: 'G2A',
  [Marketplace.KINGUIN]: 'Kinguin',
  [Marketplace.ENEBA]: 'Eneba',
  [Marketplace.GAMEFLIP]: 'GameFlip',
  [Marketplace.DLGAMER]: 'DLGamer',
  [Marketplace.MERCARI]: 'Mercari',
  [Marketplace.TRADESY]: 'Tradesy',
  [Marketplace.STOCKX]: 'StockX',
  [Marketplace.GYMSHARK]: 'Gymshark',
  [Marketplace.DECATHLON_TR]: 'Decathlon TR',
  [Marketplace.INTERSPORT_TR]: 'Intersport TR',
  [Marketplace.SPORTIVE_TR]: 'Sportive TR',
  [Marketplace.HOUZZ]: 'Houzz',
  [Marketplace.MADE_COM]: 'Made.com',
  [Marketplace.ARTICLE]: 'Article',
  [Marketplace.JOSS_MAIN]: 'Joss & Main',
  [Marketplace.BIRCH_LANE]: 'Birch Lane',
  [Marketplace.PERIGOLD]: 'Perigold',
  [Marketplace.KARACA]: 'Karaca',
  [Marketplace.MADAME_COCO]: 'Madame Coco',
  [Marketplace.ENGLISH_HOME]: 'English Home',
  [Marketplace.LINENS_N_THINGS]: "Linens 'n Things",
  [Marketplace.GARDENA]: 'Gardena',
  [Marketplace.OBI_TR]: 'Obi TR',
  [Marketplace.BAUHAUS_TR]: 'Bauhaus TR',
  [Marketplace.PATREON]: 'Patreon',
  [Marketplace.GUMROAD]: 'Gumroad',
  [Marketplace.X_SHOPPING]: 'X Shopping',
  [Marketplace.THREADS_SHOP]: 'Threads Shop',
  [Marketplace.BEREAL_SHOP]: 'BeReal Shop',
  [Marketplace.PARIBU]: 'Paribu',
  [Marketplace.OKX_TR]: 'OKX TR',
  [Marketplace.TOSLA]: 'Tosla',
  [Marketplace.PAPARA]: 'Papara',
  [Marketplace.KLARNA_MERCHANT]: 'Klarna Merchant',
  [Marketplace.AFTERPAY]: 'Afterpay',
  [Marketplace.VENMO_BUSINESS]: 'Venmo Business',
  [Marketplace.CLOVER]: 'Clover',
  [Marketplace.SQUARE_ONLINE]: 'Square Online',
  [Marketplace.MERCARI_JP]: 'Mercari JP',
  [Marketplace.YAHOO_AUCTIONS_JP]: 'Yahoo Auctions JP',
  [Marketplace.ZOZOTOWN]: 'Zozotown',
  [Marketplace.KAKAO_COMMERCE]: 'Kakao Commerce',
  [Marketplace.SHOPEE_SG]: 'Shopee SG',
  [Marketplace.SHOPEE_TH]: 'Shopee TH',
  [Marketplace.LAZADA_MY]: 'Lazada MY',
  [Marketplace.ZALORA_MY]: 'Zalora MY',
  [Marketplace.PGMALL]: 'PGMall',
  [Marketplace.KOGAN]: 'Kogan',
  [Marketplace.THEMARKET_NZ]: 'TheMarket NZ',
};

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly currencyService: CurrencyService,
  ) {}

  async getDashboardSummary(
    organizationId: string,
    period: 'default' | '24h' | '7d' | 'month' | undefined,
  ): Promise<DashboardSummaryDto> {
    const p = period ?? 'default';
    const cacheKey = `${CacheKeys.dashboard(organizationId)}:${p}`;
    return this.cache.readThrough(cacheKey, 60, async () => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);

    const orderBase: Prisma.OrderWhereInput = {
      organizationId,
      deletedAt: null,
    };

    const now = new Date();

    let windowStart = startOfToday;
    let windowEnd = now;
    let prevWindowStart = startOfYesterday;
    let prevWindowEnd = startOfToday;

    if (p === '24h') {
      windowEnd = now;
      windowStart = new Date(now.getTime() - 86_400_000);
      prevWindowEnd = windowStart;
      prevWindowStart = new Date(windowStart.getTime() - 86_400_000);
    } else if (p === '7d') {
      windowEnd = now;
      windowStart = new Date(now.getTime() - 7 * 86_400_000);
      prevWindowEnd = windowStart;
      prevWindowStart = new Date(windowStart.getTime() - 7 * 86_400_000);
    } else if (p === 'month') {
      windowEnd = now;
      windowStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const lenMs = Math.max(86_400_000, windowEnd.getTime() - windowStart.getTime());
      prevWindowEnd = new Date(windowStart.getTime());
      prevWindowStart = new Date(windowStart.getTime() - lenMs);
    }

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);

    const [
      todayOrders,
      yesterdayOrders,
      pendingOrders,
      totalProducts,
      activeConnections,
      totalConnections,
      lowStockCount,
      windowOrders,
      windowOrdersPrev,
      returnsThisMonth,
      ordersThisMonth,
    ] = await Promise.all([
      this.prisma.order.count({
        where: {
          ...orderBase,
          platformCreatedAt: { gte: startOfToday },
        },
      }),
      this.prisma.order.count({
        where: {
          ...orderBase,
          platformCreatedAt: {
            gte: startOfYesterday,
            lt: startOfToday,
          },
        },
      }),
      this.prisma.order.count({
        where: {
          ...orderBase,
          status: {
            in: [
              OrderStatus.NEW,
              OrderStatus.PICKING,
              OrderStatus.INVOICED,
            ],
          },
        },
      }),
      this.prisma.product.count({
        where: { organizationId, deletedAt: null },
      }),
      this.prisma.marketplaceConnection.count({
        where: { organizationId, deletedAt: null, isActive: true },
      }),
      this.prisma.marketplaceConnection.count({
        where: { organizationId, deletedAt: null },
      }),
      this.prisma.listing.count({
        where: {
          organizationId,
          deletedAt: null,
          quantity: { gt: 0, lte: 5 },
        },
      }),
      this.prisma.order.count({
        where: {
          ...orderBase,
          platformCreatedAt: {
            gte: windowStart,
            lte: windowEnd,
          },
        },
      }),
      this.prisma.order.count({
        where: {
          ...orderBase,
          platformCreatedAt: {
            gte: prevWindowStart,
            lt: prevWindowEnd,
          },
        },
      }),
      this.prisma.return.count({
        where: {
          organizationId,
          deletedAt: null,
          requestedAt: { gte: monthStart, lte: now },
        },
      }),
      this.prisma.order.count({
        where: {
          ...orderBase,
          platformCreatedAt: { gte: monthStart, lte: now },
        },
      }),
    ]);

    let todayOrdersDelta = 0;
    if (yesterdayOrders === 0) {
      todayOrdersDelta = todayOrders > 0 ? 100 : 0;
    } else {
      todayOrdersDelta = Math.round(
        ((todayOrders - yesterdayOrders) / yesterdayOrders) * 100,
      );
    }

    let windowOrdersDeltaPct = 0;
    if (windowOrdersPrev === 0) {
      windowOrdersDeltaPct = windowOrders > 0 ? 100 : 0;
    } else {
      windowOrdersDeltaPct = Math.round(
        ((windowOrders - windowOrdersPrev) / windowOrdersPrev) * 100,
      );
    }

    const returnRatePct =
      ordersThisMonth === 0
        ? 0
        : Math.round((returnsThisMonth / ordersThisMonth) * 1000) / 10;

    return {
      todayOrders,
      todayOrdersDelta,
      pendingOrders,
      totalProducts,
      activeConnections,
      totalConnections,
      lowStockCount,
      windowOrders,
      windowOrdersPrev,
      windowOrdersDeltaPct,
      returnsThisMonth,
      returnRatePct,
    };
    });
  }

  /**
   * Ağır rapor üretimi için read-through önbellek (10 dakika).
   */
  async generateReport<T>(
    organizationId: string,
    reportType: string,
    configDigest: string,
    producer: () => Promise<T>,
  ): Promise<T> {
    const cacheKey = CacheService.key(
      'reports',
      'generate',
      organizationId,
      reportType,
      configDigest,
    );
    return this.cache.readThrough(cacheKey, 600, producer);
  }

  async getSalesReport(
    organizationId: string,
    startDate: Date,
    endDate: Date,
    groupBy: 'day' | 'week' | 'month' = 'day',
  ): Promise<SalesReportRow[]> {
    const cacheKey = CacheService.key(
      'reports',
      'sales',
      organizationId,
      startDate.toISOString(),
      endDate.toISOString(),
      groupBy,
    );
    const cached = await this.cache.get<SalesReportRow[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const orders = await this.prisma.order.findMany({
      where: {
        organizationId,
        platformCreatedAt: { gte: startDate, lte: endDate },
        deletedAt: null,
        status: { notIn: [OrderStatus.CANCELLED, OrderStatus.RETURNED] },
      },
      select: {
        platformCreatedAt: true,
        totalAmount: true,
        platform: true,
      },
    });

    const grouped = new Map<
      string,
      {
        totalOrders: number;
        totalRevenue: number;
        byPlatform: Record<string, number>;
      }
    >();

    for (const order of orders) {
      const key = periodKeyUtc(order.platformCreatedAt, groupBy);
      if (!grouped.has(key)) {
        grouped.set(key, {
          totalOrders: 0,
          totalRevenue: 0,
          byPlatform: {},
        });
      }
      const entry = grouped.get(key)!;
      entry.totalOrders++;
      entry.totalRevenue += Number(order.totalAmount);
      const p = order.platform;
      entry.byPlatform[p] = (entry.byPlatform[p] ?? 0) + 1;
    }

    const rows = Array.from(grouped.entries())
      .map(([period, data]) => ({ period, ...data }))
      .sort((a, b) => a.period.localeCompare(b.period));
    await this.cache.set(cacheKey, rows, 300);
    return rows;
  }

  async getPlatformReport(
    organizationId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<PlatformReportRow[]> {
    const cacheKey = CacheService.key(
      'reports',
      'platform',
      organizationId,
      startDate.toISOString(),
      endDate.toISOString(),
    );
    return readThroughCache(this.cache, cacheKey, 600, async () => {
      const rows = await this.prisma.order.groupBy({
        by: ['platform'],
        where: {
          organizationId,
          deletedAt: null,
          platformCreatedAt: { gte: startDate, lte: endDate },
          status: { notIn: [OrderStatus.CANCELLED, OrderStatus.RETURNED] },
        },
        _count: { _all: true },
        _sum: { totalAmount: true },
      });

      return rows.map((r) => ({
        platform: r.platform,
        orderCount: r._count._all,
        revenue: Number(r._sum.totalAmount ?? 0),
      }));
    });
  }

  async getTopProducts(
    organizationId: string,
    limit = 20,
    startDate?: Date,
    endDate?: Date,
  ): Promise<TopProductRow[]> {
    const orderFilter: Prisma.OrderWhereInput | undefined =
      startDate && endDate
        ? {
            platformCreatedAt: { gte: startDate, lte: endDate },
            deletedAt: null,
            status: { notIn: [OrderStatus.CANCELLED, OrderStatus.RETURNED] },
          }
        : undefined;

    const items = await this.prisma.orderItem.groupBy({
      by: ['barcode'],
      where: {
        organizationId,
        ...(orderFilter && { order: orderFilter }),
      },
      _sum: { quantity: true },
      _count: { id: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: limit,
    });

    return items.map((item) => ({
      barcode: item.barcode,
      totalQuantity: item._sum.quantity ?? 0,
      orderCount: item._count.id,
    }));
  }

  async getStockMovementReport(
    organizationId: string,
    limit = 100,
    startDate?: Date,
    endDate?: Date,
  ): Promise<StockMovementRow[]> {
    const updatedAt: Prisma.DateTimeFilter | undefined =
      startDate && endDate
        ? { gte: startDate, lte: endDate }
        : startDate
          ? { gte: startDate }
          : endDate
            ? { lte: endDate }
            : undefined;

    const rows = await this.prisma.stockEntry.findMany({
      where: {
        organizationId,
        ...(updatedAt && { updatedAt }),
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      select: {
        barcode: true,
        platform: true,
        quantity: true,
        reservedQty: true,
        updatedAt: true,
      },
    });

    return rows.map((r) => ({
      barcode: r.barcode,
      platform: r.platform,
      quantity: r.quantity,
      reservedQty: r.reservedQty,
      updatedAt: r.updatedAt.toISOString(),
    }));
  }

  async getProfitReport(
    organizationId: string,
    params: { from: Date; to: Date; platform?: Marketplace },
  ): Promise<ProfitReportDto> {
    const cacheKey = CacheService.key(
      'reports',
      'profit',
      organizationId,
      params.from.toISOString(),
      params.to.toISOString(),
      params.platform ?? 'all',
    );
    return readThroughCache<ProfitReportDto>(this.cache, cacheKey, 1800, async () => {
    const orderWhere: Prisma.OrderWhereInput = {
      organizationId,
      deletedAt: null,
      platformCreatedAt: { gte: params.from, lte: params.to },
      status: { notIn: [OrderStatus.CANCELLED, OrderStatus.RETURNED] },
      ...(params.platform ? { platform: params.platform } : {}),
    };

    const prefs =
      await this.currencyService.getOrgCurrencyPrefs(organizationId);

    const [orders, orderItems] = await Promise.all([
      this.prisma.order.findMany({
        where: orderWhere,
        select: {
          totalAmount: true,
          currency: true,
          platformCreatedAt: true,
          platform: true,
        },
      }),
      this.prisma.orderItem.findMany({
        where: {
          organizationId,
          order: orderWhere,
        },
        select: {
          barcode: true,
          productName: true,
          quantity: true,
          unitPrice: true,
          order: {
            select: { currency: true, platformCreatedAt: true },
          },
        },
      }),
    ]);

    const conversions = await Promise.all(
      orders.map(async (o) => {
        const cur = (o.currency ?? 'TRY').trim().toUpperCase();
        const raw = Number(o.totalAmount);
        const conv = await this.currencyService.orderAmountToTryForReport(
          new Decimal(raw),
          cur,
          o.platformCreatedAt,
          prefs,
        );
        return { o, cur, raw, conv };
      }),
    );

    let totalRevenueTry = 0;
    let ordersWithApproximateTryConversion = 0;
    const originalMap = new Map<string, { totalOriginal: number; orderCount: number }>();
    const byPlatformMap = new Map<
      Marketplace,
      { revenue: number; orderCount: number }
    >();

    for (const { o, cur, raw, conv } of conversions) {
      totalRevenueTry += conv.tryAmount;
      if (conv.usedDirect) {
        ordersWithApproximateTryConversion++;
      }
      const prevOrig = originalMap.get(cur) ?? {
        totalOriginal: 0,
        orderCount: 0,
      };
      prevOrig.totalOriginal += raw;
      prevOrig.orderCount += 1;
      originalMap.set(cur, prevOrig);

      const prevPl = byPlatformMap.get(o.platform) ?? {
        revenue: 0,
        orderCount: 0,
      };
      prevPl.revenue += conv.tryAmount;
      prevPl.orderCount += 1;
      byPlatformMap.set(o.platform, prevPl);
    }

    const byPlatform = Array.from(byPlatformMap.entries()).map(
      ([platform, row]) => ({
        platform,
        revenue: row.revenue,
        orderCount: row.orderCount,
      }),
    );

    const revenueByOriginalCurrency = Array.from(originalMap.entries())
      .map(([currency, v]) => ({
        currency,
        totalOriginal: v.totalOriginal,
        orderCount: v.orderCount,
      }))
      .sort((a, b) => a.currency.localeCompare(b.currency));

    const estimatedProfit = totalRevenueTry * 0.2;
    const profitMargin =
      totalRevenueTry > 0 ? (estimatedProfit / totalRevenueTry) * 100 : 0;

    const lineConversions = await Promise.all(
      orderItems.map(async (it) => {
        const cur = (it.order.currency ?? 'TRY').trim().toUpperCase();
        const lineOrig = Number(it.unitPrice) * it.quantity;
        const conv = await this.currencyService.orderAmountToTryForReport(
          new Decimal(lineOrig),
          cur,
          it.order.platformCreatedAt,
          prefs,
        );
        return { it, lineTry: conv.tryAmount };
      }),
    );

    const aggByBarcode = new Map<
      string,
      { revenue: number; quantity: number; nameHint: string | null }
    >();
    for (const { it, lineTry } of lineConversions) {
      const prev = aggByBarcode.get(it.barcode);
      const nameHint =
        it.productName && it.productName.trim().length > 0
          ? it.productName.trim()
          : null;
      if (!prev) {
        aggByBarcode.set(it.barcode, {
          revenue: lineTry,
          quantity: it.quantity,
          nameHint,
        });
      } else {
        prev.revenue += lineTry;
        prev.quantity += it.quantity;
        if (!prev.nameHint && nameHint) {
          prev.nameHint = nameHint;
        }
      }
    }

    const sortedBarcodes = Array.from(aggByBarcode.entries())
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 10)
      .map(([b]) => b);

    const products =
      sortedBarcodes.length > 0
        ? await this.prisma.product.findMany({
            where: {
              organizationId,
              deletedAt: null,
              barcode: { in: sortedBarcodes },
            },
            select: { barcode: true, name: true },
          })
        : [];
    const productNameByBarcode = new Map(
      products.map((p) => [p.barcode, p.name] as const),
    );

    const topProducts = sortedBarcodes.map((barcode) => {
      const row = aggByBarcode.get(barcode)!;
      const fromProduct = productNameByBarcode.get(barcode);
      const name = row.nameHint ?? fromProduct ?? barcode;
      return {
        name,
        barcode,
        revenue: row.revenue,
        quantity: row.quantity,
      };
    });

    return {
      totalRevenueTry,
      totalRevenue: totalRevenueTry,
      revenueByOriginalCurrency,
      ordersWithApproximateTryConversion,
      estimatedProfit,
      profitMargin,
      byPlatform,
      topProducts,
    };
    });
  }

  async getStockValueReport(
    organizationId: string,
  ): Promise<StockValueReportDto> {
    const cacheKey = CacheService.key(
      'reports',
      'stock-value',
      organizationId,
      'current',
    );
    return readThroughCache(this.cache, cacheKey, 900, async () => {
    const listings = await this.prisma.listing.findMany({
      where: { organizationId, deletedAt: null },
      select: {
        platform: true,
        barcode: true,
        salePrice: true,
        quantity: true,
      },
    });

    let totalStockValue = 0;
    let outOfStockCount = 0;
    let lowStockCount = 0;
    const distinctProducts = new Set<string>();
    const byPlatform = new Map<
      Marketplace,
      { totalValue: number; skuCount: number }
    >();

    for (const L of listings) {
      distinctProducts.add(L.barcode);
      const price = Number(L.salePrice);
      const value = price * L.quantity;
      totalStockValue += value;

      if (L.quantity === 0) {
        outOfStockCount++;
      } else if (L.quantity <= 5) {
        lowStockCount++;
      }

      const cur = byPlatform.get(L.platform) ?? { totalValue: 0, skuCount: 0 };
      cur.totalValue += value;
      cur.skuCount++;
      byPlatform.set(L.platform, cur);
    }

    return {
      totalProducts: distinctProducts.size,
      totalSkus: listings.length,
      totalStockValue,
      outOfStockCount,
      lowStockCount,
      byPlatform: Array.from(byPlatform.entries()).map(([platform, v]) => ({
        platform,
        totalValue: v.totalValue,
        skuCount: v.skuCount,
      })),
    };
    });
  }

  async getOrderTrend(
    organizationId: string,
    params: {
      granularity: 'daily' | 'weekly' | 'monthly';
      from: Date;
      to: Date;
    },
  ): Promise<OrderTrendDto> {
    const cacheKey = CacheService.key(
      'reports',
      'order-trend',
      organizationId,
      params.granularity,
      params.from.toISOString(),
      params.to.toISOString(),
    );
    return readThroughCache(this.cache, cacheKey, 600, async () => {
    const groupBy =
      params.granularity === 'daily'
        ? 'day'
        : params.granularity === 'weekly'
          ? 'week'
          : 'month';
    const rows = await this.getSalesReport(
      organizationId,
      params.from,
      params.to,
      groupBy,
    );
    return {
      labels: rows.map((r) => r.period),
      orderCounts: rows.map((r) => r.totalOrders),
      revenues: rows.map((r) => r.totalRevenue),
    };
    });
  }

  async getPlatformComparison(
    organizationId: string,
    params: { from: Date; to: Date },
  ): Promise<PlatformComparisonDto> {
    const cacheKey = CacheService.key(
      'reports',
      'platform-comparison',
      organizationId,
      params.from.toISOString(),
      params.to.toISOString(),
    );
    return readThroughCache(this.cache, cacheKey, 1800, async () => {
    const baseWhere: Prisma.OrderWhereInput = {
      organizationId,
      deletedAt: null,
      platformCreatedAt: { gte: params.from, lte: params.to },
    };

    const [goodRows, totalRows, badRows, connections] = await Promise.all([
      this.prisma.order.groupBy({
        by: ['platform'],
        where: {
          ...baseWhere,
          status: { notIn: [OrderStatus.CANCELLED, OrderStatus.RETURNED] },
        },
        _count: { _all: true },
        _sum: { totalAmount: true },
      }),
      this.prisma.order.groupBy({
        by: ['platform'],
        where: baseWhere,
        _count: { _all: true },
      }),
      this.prisma.order.groupBy({
        by: ['platform'],
        where: {
          ...baseWhere,
          status: { in: [OrderStatus.CANCELLED, OrderStatus.RETURNED] },
        },
        _count: { _all: true },
      }),
      this.prisma.marketplaceConnection.findMany({
        where: { organizationId, deletedAt: null },
        select: {
          platform: true,
          isActive: true,
          lastSyncAt: true,
          syncErrorCount: true,
        },
      }),
    ]);

    const goodMap = new Map(
      goodRows.map((r) => [
        r.platform,
        {
          orderCount: r._count._all,
          revenue: Number(r._sum.totalAmount ?? 0),
        },
      ] as const),
    );
    const totalMap = new Map(
      totalRows.map((r) => [r.platform, r._count._all] as const),
    );
    const badMap = new Map(
      badRows.map((r) => [r.platform, r._count._all] as const),
    );

    const platformSet = new Set<Marketplace>();
    for (const c of connections) {
      platformSet.add(c.platform);
    }
    for (const p of totalMap.keys()) {
      platformSet.add(p);
    }
    for (const p of goodMap.keys()) {
      platformSet.add(p);
    }

    const connByPlatform = new Map(
      connections.map((c) => [c.platform, c] as const),
    );

    const platforms: PlatformComparisonRowDto[] = Array.from(platformSet)
      .sort((a, b) => a.localeCompare(b))
      .map((platform) => {
        const good = goodMap.get(platform);
        const orderCount = good?.orderCount ?? 0;
        const revenue = good?.revenue ?? 0;
        const avgOrderValue = orderCount > 0 ? revenue / orderCount : 0;
        const totalOrders = totalMap.get(platform) ?? 0;
        const badOrders = badMap.get(platform) ?? 0;
        const returnRate =
          totalOrders > 0 ? (badOrders / totalOrders) * 100 : 0;
        return {
          name: MARKETPLACE_LABEL_TR[platform] ?? platform,
          orderCount,
          revenue,
          avgOrderValue,
          returnRate,
          syncStatus: this.describeConnectionSync(
            connByPlatform.get(platform),
          ),
        };
      });

    return { platforms };
    });
  }

  private describeConnectionSync(
    connection:
      | {
          isActive: boolean;
          lastSyncAt: Date | null;
          syncErrorCount: number;
        }
      | undefined,
  ): string {
    if (!connection) {
      return 'Bağlantı yok';
    }
    if (!connection.isActive) {
      return 'Pasif';
    }
    if (connection.syncErrorCount > 0) {
      return 'Senkron hatası';
    }
    if (!connection.lastSyncAt) {
      return 'Henüz senkron yok';
    }
    const hours =
      (Date.now() - connection.lastSyncAt.getTime()) / (60 * 60 * 1000);
    if (hours > 48) {
      return 'Senkron gecikti';
    }
    return 'Güncel';
  }
}
