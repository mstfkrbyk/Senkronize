import type { BillingPeriod, PlanTier } from '@prisma/client';

export interface CheckoutFormParams {
  conversationId: string;
  callbackUrl: string;
  pricingPlanReferenceCode: string;
  customer: IyzicoCustomerPayload;
  locale?: string;
}

export interface IyzicoCustomerPayload {
  name: string;
  surname: string;
  email: string;
  gsmNumber: string;
  identityNumber: string;
  billingAddress: IyzicoAddressPayload;
  shippingAddress?: IyzicoAddressPayload;
}

export interface IyzicoAddressPayload {
  contactName: string;
  city: string;
  district: string;
  country: string;
  address: string;
  zipCode: string;
}

export interface CheckoutFormResult {
  status: string;
  token?: string;
  checkoutFormContent?: string;
  paymentPageUrl?: string;
  subscriptionReferenceCode?: string;
  customerReferenceCode?: string;
  conversationId?: string;
  errorCode?: string;
  errorMessage?: string;
}

export interface PlanParams {
  name: string;
  priceTry: number;
  billingPeriod: BillingPeriod;
}

export interface SubscriptionParams {
  conversationId: string;
  callbackUrl: string;
  pricingPlanReferenceCode: string;
  customerReferenceCode: string;
}

export interface SubscriptionResult {
  status: string;
  subscriptionReferenceCode?: string;
  errorCode?: string;
  errorMessage?: string;
}

export interface SubscriptionDetails {
  status: string;
  subscriptionReferenceCode: string;
  pricingPlanReferenceCode?: string;
  customerReferenceCode?: string;
}

export interface IyzicoWebhookPayload {
  orderReferenceCode?: string;
  customerReferenceCode?: string;
  subscriptionReferenceCode?: string;
  iyziReferenceCode?: string;
  iyziEventType?: string;
  iyziEventTime?: number;
  merchantId?: string;
  eventType?: string;
}

export type IyzicoWebhookEventType =
  | 'SUBSCRIPTION_ORDER_SUCCESS'
  | 'SUBSCRIPTION_ORDER_FAILURE'
  | 'SUBSCRIPTION_CANCELED'
  | 'SUBSCRIPTION_UPGRADED';

export function normalizeIyzicoEventType(
  raw: string | undefined,
): IyzicoWebhookEventType | null {
  if (!raw) {
    return null;
  }
  const normalized = raw
    .trim()
    .toUpperCase()
    .replace(/\./g, '_')
    .replace(/-/g, '_');
  const map: Record<string, IyzicoWebhookEventType> = {
    SUBSCRIPTION_ORDER_SUCCESS: 'SUBSCRIPTION_ORDER_SUCCESS',
    SUBSCRIPTION_ORDER_FAILURE: 'SUBSCRIPTION_ORDER_FAILURE',
    SUBSCRIPTION_CANCELED: 'SUBSCRIPTION_CANCELED',
    SUBSCRIPTION_CANCELLED: 'SUBSCRIPTION_CANCELED',
    SUBSCRIPTION_UPGRADED: 'SUBSCRIPTION_UPGRADED',
  };
  return map[normalized] ?? null;
}

export interface PlanPriceKey {
  plan: PlanTier;
  billingPeriod: BillingPeriod;
}
