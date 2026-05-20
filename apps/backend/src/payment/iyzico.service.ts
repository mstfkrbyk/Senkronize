import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BillingPeriod,
  type Organization,
  PlanTier,
  type User,
} from '@prisma/client';
import Iyzipay from 'iyzipay';
import type {
  CheckoutFormParams,
  CheckoutFormResult,
  IyzicoAddressPayload,
  PlanParams,
  SubscriptionDetails,
  SubscriptionParams,
  SubscriptionResult,
} from './iyzico.types';

interface IyzipayApiResponse {
  status?: string;
  errorCode?: string;
  errorMessage?: string;
  token?: string;
  checkoutFormContent?: string;
  paymentPageUrl?: string;
  data?: {
    referenceCode?: string;
    productReferenceCode?: string;
    pricingPlanReferenceCode?: string;
    customerReferenceCode?: string;
    subscriptionReferenceCode?: string;
    token?: string;
    checkoutFormContent?: string;
    paymentPageUrl?: string;
  };
  referenceCode?: string;
  productReferenceCode?: string;
  pricingPlanReferenceCode?: string;
  customerReferenceCode?: string;
  subscriptionReferenceCode?: string;
}

function splitName(fullName: string | null): { name: string; surname: string } {
  const trimmed = (fullName ?? 'Kullanıcı').trim() || 'Kullanıcı';
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return { name: parts[0], surname: 'Kullanıcı' };
  }
  return {
    name: parts.slice(0, -1).join(' '),
    surname: parts[parts.length - 1] ?? 'Kullanıcı',
  };
}

function mapApiResponse(body: unknown): IyzipayApiResponse {
  if (!body || typeof body !== 'object') {
    return { status: 'failure', errorMessage: 'Geçersiz Iyzico yanıtı' };
  }
  return body as IyzipayApiResponse;
}

function refFromResponse(res: IyzipayApiResponse): string | undefined {
  return (
    res.data?.referenceCode ??
    res.referenceCode ??
    res.data?.productReferenceCode ??
    res.productReferenceCode ??
    res.data?.pricingPlanReferenceCode ??
    res.pricingPlanReferenceCode ??
    res.data?.customerReferenceCode ??
    res.customerReferenceCode ??
    res.data?.subscriptionReferenceCode ??
    res.subscriptionReferenceCode
  );
}

@Injectable()
export class IyzicoService {
  private readonly logger = new Logger(IyzicoService.name);
  private readonly iyzipay: Iyzipay;

  constructor(private readonly config: ConfigService) {
    this.iyzipay = new Iyzipay({
      apiKey: this.config.getOrThrow<string>('IYZICO_API_KEY'),
      secretKey: this.config.getOrThrow<string>('IYZICO_SECRET_KEY'),
      uri:
        this.config.get<string>('IYZICO_URI') ??
        'https://sandbox-api.iyzipay.com',
    });
  }

  private promisify<T>(
    executor: (cb: (err: Error | null, result: T) => void) => void,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      executor((err, result) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(result);
      });
    });
  }

  private assertSuccess(res: IyzipayApiResponse, context: string): void {
    if (res.status !== 'success') {
      this.logger.warn(`Iyzico ${context} başarısız`, {
        errorCode: res.errorCode,
        errorMessage: res.errorMessage,
      });
      throw new Error(res.errorMessage ?? `iyzico_${context}_failed`);
    }
  }

  async createCheckoutForm(
    params: CheckoutFormParams,
  ): Promise<CheckoutFormResult> {
    const body = await this.promisify<unknown>((cb) => {
      this.iyzipay.subscriptionCheckoutForm.initialize(
        {
          locale: params.locale ?? Iyzipay.LOCALE.TR,
          conversationId: params.conversationId,
          callbackUrl: params.callbackUrl,
          pricingPlanReferenceCode: params.pricingPlanReferenceCode,
          subscriptionInitialStatus: Iyzipay.SUBSCRIPTION_INITIAL_STATUS.ACTIVE,
          customer: params.customer,
        },
        cb,
      );
    });
    const res = mapApiResponse(body);
    this.assertSuccess(res, 'checkout_initialize');
    return {
      status: res.status ?? 'success',
      token: res.token ?? res.data?.token,
      checkoutFormContent:
        res.checkoutFormContent ?? res.data?.checkoutFormContent,
      paymentPageUrl: res.paymentPageUrl ?? res.data?.paymentPageUrl,
      conversationId: params.conversationId,
    };
  }

  async retrieveCheckoutForm(token: string): Promise<CheckoutFormResult> {
    const body = await this.promisify<unknown>((cb) => {
      this.iyzipay.subscriptionCheckoutForm.retrieve(
        {
          locale: Iyzipay.LOCALE.TR,
          checkoutFormToken: token,
        },
        cb,
      );
    });
    const res = mapApiResponse(body);
    return {
      status: res.status ?? 'failure',
      token,
      subscriptionReferenceCode:
        res.data?.subscriptionReferenceCode ?? res.subscriptionReferenceCode,
      customerReferenceCode:
        res.data?.customerReferenceCode ?? res.customerReferenceCode,
      conversationId: undefined,
      errorCode: res.errorCode,
      errorMessage: res.errorMessage,
    };
  }

  async createSubscriptionProduct(
    name: string,
    locale: string,
  ): Promise<string> {
    const body = await this.promisify<unknown>((cb) => {
      this.iyzipay.subscriptionProduct.create(
        {
          locale,
          conversationId: `prod-${Date.now()}`,
          name,
          description: name,
        },
        cb,
      );
    });
    const res = mapApiResponse(body);
    this.assertSuccess(res, 'product_create');
    const ref = refFromResponse(res);
    if (!ref) {
      throw new Error('iyzico_product_ref_missing');
    }
    return ref;
  }

  async createSubscriptionPricingPlan(
    productRefCode: string,
    plan: PlanParams,
  ): Promise<string> {
    const interval =
      plan.billingPeriod === BillingPeriod.YEARLY
        ? Iyzipay.SUBSCRIPTION_PRICING_PLAN_INTERVAL.YEARLY
        : Iyzipay.SUBSCRIPTION_PRICING_PLAN_INTERVAL.MONTHLY;

    const body = await this.promisify<unknown>((cb) => {
      this.iyzipay.subscriptionPricingPlan.create(
        {
          locale: Iyzipay.LOCALE.TR,
          conversationId: `plan-${Date.now()}`,
          productReferenceCode: productRefCode,
          name: plan.name,
          price: plan.priceTry,
          currencyCode: 'TRY',
          paymentInterval: interval,
          paymentIntervalCount: 1,
          planPaymentType: Iyzipay.PLAN_PAYMENT_TYPE.RECURRING,
        },
        cb,
      );
    });
    const res = mapApiResponse(body);
    this.assertSuccess(res, 'pricing_plan_create');
    const ref = refFromResponse(res);
    if (!ref) {
      throw new Error('iyzico_pricing_plan_ref_missing');
    }
    return ref;
  }

  buildCustomerPayload(
    user: User,
    org: Organization,
  ): CheckoutFormParams['customer'] {
    const { name, surname } = splitName(user.name);
    const addressLine =
      [org.address, org.city].filter((v) => v && v.trim().length > 0).join(', ') ||
      'Türkiye';
    const address: IyzicoAddressPayload = {
      contactName: user.name?.trim() || `${name} ${surname}`,
      city: org.city?.trim() || 'Istanbul',
      district: org.city?.trim() || 'Merkez',
      country: 'Turkey',
      address: addressLine,
      zipCode: '34000',
    };
    const gsm = user.phone?.trim()
      ? user.phone.trim().startsWith('+')
        ? user.phone.trim()
        : `+90${user.phone.trim().replace(/^0/, '')}`
      : '+905000000000';

    return {
      name,
      surname,
      email: user.email,
      gsmNumber: gsm,
      identityNumber: '11111111111',
      billingAddress: address,
      shippingAddress: address,
    };
  }

  async createSubscriptionCustomer(
    user: User,
    org: Organization,
  ): Promise<string> {
    const customer = this.buildCustomerPayload(user, org);
    const body = await this.promisify<unknown>((cb) => {
      this.iyzipay.subscriptionCustomer.create(
        {
          locale: Iyzipay.LOCALE.TR,
          conversationId: `cust-${org.id.slice(-8)}-${Date.now()}`,
          ...customer,
        },
        cb,
      );
    });
    const res = mapApiResponse(body);
    this.assertSuccess(res, 'customer_create');
    const ref = refFromResponse(res);
    if (!ref) {
      throw new Error('iyzico_customer_ref_missing');
    }
    return ref;
  }

  async createSubscription(
    params: SubscriptionParams,
  ): Promise<SubscriptionResult> {
    const body = await this.promisify<unknown>((cb) => {
      this.iyzipay.subscriptionExistingCustomer.initialize(
        {
          locale: Iyzipay.LOCALE.TR,
          conversationId: params.conversationId,
          callbackUrl: params.callbackUrl,
          pricingPlanReferenceCode: params.pricingPlanReferenceCode,
          subscriptionInitialStatus: Iyzipay.SUBSCRIPTION_INITIAL_STATUS.ACTIVE,
          customerReferenceCode: params.customerReferenceCode,
        },
        cb,
      );
    });
    const res = mapApiResponse(body);
    this.assertSuccess(res, 'subscription_initialize');
    return {
      status: res.status ?? 'success',
      subscriptionReferenceCode:
        res.data?.subscriptionReferenceCode ?? res.subscriptionReferenceCode,
    };
  }

  async cancelSubscription(subscriptionRefCode: string): Promise<void> {
    const body = await this.promisify<unknown>((cb) => {
      this.iyzipay.subscription.cancel(
        {
          locale: Iyzipay.LOCALE.TR,
          conversationId: `cancel-${Date.now()}`,
          subscriptionReferenceCode: subscriptionRefCode,
        },
        cb,
      );
    });
    const res = mapApiResponse(body);
    this.assertSuccess(res, 'subscription_cancel');
  }

  async upgradeSubscription(
    subscriptionRefCode: string,
    newPricingPlanRefCode: string,
  ): Promise<void> {
    const body = await this.promisify<unknown>((cb) => {
      this.iyzipay.subscription.upgrade(
        {
          locale: Iyzipay.LOCALE.TR,
          conversationId: `upgrade-${Date.now()}`,
          subscriptionReferenceCode: subscriptionRefCode,
          newPricingPlanReferenceCode: newPricingPlanRefCode,
          upgradePeriod: Iyzipay.SUBSCRIPTION_UPGRADE_PERIOD.NOW,
          useTrial: false,
        },
        cb,
      );
    });
    const res = mapApiResponse(body);
    this.assertSuccess(res, 'subscription_upgrade');
  }

  async getSubscriptionDetails(
    subscriptionRefCode: string,
  ): Promise<SubscriptionDetails> {
    const body = await this.promisify<unknown>((cb) => {
      this.iyzipay.subscription.retrieve(
        {
          locale: Iyzipay.LOCALE.TR,
          conversationId: `detail-${Date.now()}`,
          subscriptionReferenceCode: subscriptionRefCode,
        },
        cb,
      );
    });
    const res = mapApiResponse(body);
    this.assertSuccess(res, 'subscription_retrieve');
    return {
      status: res.status ?? 'unknown',
      subscriptionReferenceCode: subscriptionRefCode,
      pricingPlanReferenceCode:
        res.data?.pricingPlanReferenceCode ?? res.pricingPlanReferenceCode,
      customerReferenceCode:
        res.data?.customerReferenceCode ?? res.customerReferenceCode,
    };
  }

  getMerchantId(): string {
    return this.config.getOrThrow<string>('IYZICO_MERCHANT_ID');
  }

  getSecretKey(): string {
    return this.config.getOrThrow<string>('IYZICO_SECRET_KEY');
  }
}
