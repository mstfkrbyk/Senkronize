/** Prisma `OrgType` ile uyumlu */
export type OrgType = 'DIRECT' | 'PARTNER';

/** Prisma `UserRole` ile uyumlu */
export type UserRole =
  | 'SUPER_ADMIN'
  | 'OWNER'
  | 'ADMIN'
  | 'MANAGER'
  | 'VIEWER';

/** Prisma `PlanTier` ile uyumlu */
export type PlanTier = 'BASLANGIC' | 'GELISIM' | 'PRO' | 'KURUMSAL';

/** Prisma `SubStatus` ile uyumlu */
export type SubStatus =
  | 'TRIAL'
  | 'ACTIVE'
  | 'PAUSED'
  | 'CANCELLED'
  | 'EXPIRED';

/** Prisma `Marketplace` ile uyumlu */
export type Marketplace =
  | 'TRENDYOL'
  | 'HEPSIBURADA'
  | 'N11'
  | 'AMAZON_TR'
  | 'CICEKSEPETI'
  | 'IDEASOFT'
  | 'PTTAVM'
  | 'PAZARAMA'
  | 'TSOFT'
  | 'TICIMAX'
  | 'WOOCOMMERCE'
  | 'SHOPIFY';

/** Prisma `ErpType` ile uyumlu */
export type ErpType =
  | 'BIZIMHESAP'
  | 'PARASUT'
  | 'TSOFT'
  | 'TICIMAX'
  | 'LOGO'
  | 'MIKRO'
  | 'LUCA';

/** Prisma `EcommerceType` ile uyumlu */
export type EcommerceType = 'TICIMAX' | 'TSOFT';

/** Prisma `CargoProvider` ile uyumlu */
export type CargoProvider =
  | 'YURTICI'
  | 'ARAS'
  | 'MNG'
  | 'SURAT'
  | 'PTT'
  | 'UPS'
  | 'DHL'
  | 'HEPSIJET'
  | 'TRENDYOL_EXPRESS';

/** Prisma `PartnerStatus` ile uyumlu */
export type PartnerStatus = 'ACTIVE' | 'PAUSED' | 'TERMINATED';

/** Prisma `CommissionStatus` ile uyumlu */
export type CommissionStatus = 'PENDING' | 'PAID' | 'CANCELLED';

/** Prisma `SyncDirection` ile uyumlu */
export type SyncDirection = 'PUSH' | 'PULL';
