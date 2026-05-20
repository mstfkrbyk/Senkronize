import type { BillingPeriod, PlanTier } from '@prisma/client';

export type PlanType = PlanTier;

export interface SubscriptionCheckoutParams {
  userId: string;
  orgId: string;
  plan: PlanTier;
  billingPeriod: BillingPeriod;
  email: string;
  name: string;
  priceTry: number;
  callbackUrl: string;
  conversationId: string;
  buyerIp?: string;
  orgCity?: string | null;
  orgAddress?: string | null;
}

export interface SubscriptionCheckoutResult {
  checkoutFormContent: string;
  token: string;
  tokenExpireTime: number;
  conversationId: string;
}

export interface CheckoutCallbackResult {
  success: boolean;
  conversationId: string;
  orderId: string;
  plan: PlanTier;
  billingPeriod?: BillingPeriod;
  paidPriceTry?: number;
  cardUserKey?: string;
  cardToken?: string;
  cardLastFour?: string;
  errorMessage?: string;
}

export interface StoredCardChargeParams {
  conversationId: string;
  orgId: string;
  plan: PlanTier;
  billingPeriod: BillingPeriod;
  priceTry: number;
  cardUserKey: string;
  cardToken: string;
  buyer: {
    id: string;
    name: string;
    surname: string;
    email: string;
    gsmNumber: string;
    identityNumber: string;
    city: string;
    country: string;
    address: string;
    zipCode: string;
  };
  billingAddress: IyzicoAddressPayload;
}

export interface StoredCardChargeResult {
  paymentId: string;
  paidPriceTry: number;
}

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
