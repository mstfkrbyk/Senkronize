export interface DigestNotificationRow {
  eventType: string;
  title: string;
  message: string;
  link: string | null;
  createdAt: string;
}

export interface DigestEmailData {
  recipientName: string;
  periodLabel: string;
  totalCount: number;
  ordersSection: string;
  stockSection: string;
  syncSection: string;
  otherSection: string;
  panelUrl: string;
  settingsUrl: string;
}

export interface WelcomeEmailData {
  name: string;
}

export interface OrderLineItem {
  name: string;
  quantity: number;
  lineTotalTry: string;
}

export interface OrderEmailData {
  orderNumber: string;
  platform: string;
  orderDate: string;
  totalTry: string;
  items: OrderLineItem[];
  deliveryAddress: string;
  orderViewUrl: string;
}

export interface LowStockProductRow {
  name: string;
  sku: string;
  currentStock: number;
  threshold: number;
}

export interface LowStockEmailData {
  recipientName: string;
  count: number;
  products: LowStockProductRow[];
  stockUpdateUrl: string;
}

export interface CriticalStockForecastRow {
  name: string;
  barcode: string;
  daysLeft: string;
  recommendedQty: string;
}

export interface CriticalStockForecastEmailData {
  recipientName: string;
  count: number;
  products: CriticalStockForecastRow[];
  forecastUrl: string;
}

export interface TrialExpiringData {
  name: string;
  trialEndDate: string;
  daysLeft: number;
  lostFeatures: string[];
  currentPlanLabel: string;
  suggestedPlanLabel: string;
  subscribeUrl: string;
  ordersCount: number;
  syncJobsCount: number;
}

export interface PlanChangedData {
  name: string;
  previousPlanLabel: string;
  newPlanLabel: string;
  effectiveDate: string;
  newFeatures: string[];
  exploreUrl: string;
  isUpgrade: boolean;
}

export interface InvoiceEmailData {
  recipientName: string;
  invoiceNumber: string;
  invoiceDate: string;
  companyName: string;
  companyTaxId: string;
  /** Düz metin; satır sonları HTML'e güvenli şekilde dönüştürülür */
  companyAddress: string;
  planName: string;
  billingPeriodLabel: string;
  amountExclVatTry: string;
  vatRatePercent: string;
  vatAmountTry: string;
  totalInclVatTry: string;
  invoiceDownloadUrl: string;
  nextPaymentDate: string;
}

export interface PartnerInviteData {
  partnerName: string;
  platformName: string;
  inviteUrl: string;
  partnerLogoUrl?: string;
  message?: string;
}

export type EmailPreviewTemplate =
  | 'welcome'
  | 'order-new'
  | 'low-stock'
  | 'trial-expiring'
  | 'plan-changed'
  | 'invoice'
  | 'partner-invite';
