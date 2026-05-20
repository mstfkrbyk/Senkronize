import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BillingPeriod,
  PaymentStatus,
  type Organization,
  PlanTier,
  UserRole,
  type User,
} from '@prisma/client';
import Iyzipay from 'iyzipay';
import { EncryptionService } from '../common/encryption/encryption.service';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CheckoutCallbackResult,
  CheckoutFormParams,
  CheckoutFormResult,
  IyzicoAddressPayload,
  PlanParams,
  StoredCardChargeParams,
  StoredCardChargeResult,
  SubscriptionCheckoutParams,
  SubscriptionCheckoutResult,
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
  tokenExpireTime?: number;
  paymentStatus?: string;
  paymentId?: string;
  paidPrice?: string | number;
  price?: string | number;
  basketId?: string;
  conversationId?: string;
  cardUserKey?: string;
  cardToken?: string;
  lastFourDigits?: string;
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

const PLAN_TIER_VALUES = new Set<string>(Object.values(PlanTier));
const BILLING_PERIOD_VALUES = new Set<string>(Object.values(BillingPeriod));

function parsePlanFromBasketId(
  basketId: string | undefined,
): { plan: PlanTier; billingPeriod?: BillingPeriod } | null {
  if (!basketId) {
    return null;
  }
  const parts = basketId.split('-');
  if (parts.length < 2) {
    return null;
  }
  const planCandidate = parts[0];
  if (!PLAN_TIER_VALUES.has(planCandidate)) {
    return null;
  }
  const billingCandidate = parts.length >= 3 ? parts[1] : undefined;
  const billingPeriod =
    billingCandidate && BILLING_PERIOD_VALUES.has(billingCandidate)
      ? (billingCandidate as BillingPeriod)
      : undefined;
  return { plan: planCandidate as PlanTier, billingPeriod };
}

function formatPriceTry(amount: number): string {
  return amount.toFixed(2);
}

@Injectable()
export class IyzicoService {
  private readonly logger = new Logger(IyzicoService.name);
  private readonly iyzipay: Iyzipay;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly encryptionService: EncryptionService,
  ) {
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

  async createSubscriptionCheckout(
    params: SubscriptionCheckoutParams,
  ): Promise<SubscriptionCheckoutResult> {
    const conversationId = params.conversationId;
    const { name, surname } = splitName(params.name);
    const addressLine =
      [params.orgAddress, params.orgCity].filter((v) => v && v.trim().length > 0).join(', ') ||
      'Türkiye';
    const city = params.orgCity?.trim() || 'Istanbul';
    const billingAddress: IyzicoAddressPayload = {
      contactName: params.name.trim() || `${name} ${surname}`,
      city,
      district: city,
      country: 'Turkey',
      address: addressLine,
      zipCode: '34000',
    };
    const priceStr = formatPriceTry(params.priceTry);
    const basketId = `${params.plan}-${params.billingPeriod}-${params.orgId}`;

    const body = await this.promisify<unknown>((cb) => {
      this.iyzipay.checkoutFormInitialize.create(
        {
          locale: Iyzipay.LOCALE.TR,
          conversationId,
          price: priceStr,
          paidPrice: priceStr,
          currency: Iyzipay.CURRENCY.TRY,
          basketId,
          paymentGroup: Iyzipay.PAYMENT_GROUP.SUBSCRIPTION,
          callbackUrl: params.callbackUrl,
          enabledInstallments: [1],
          buyer: {
            id: params.userId,
            name,
            surname,
            gsmNumber: '+905000000000',
            email: params.email,
            identityNumber: '11111111111',
            lastLoginDate: new Date().toISOString().slice(0, 19).replace('T', ' '),
            registrationDate: new Date().toISOString().slice(0, 19).replace('T', ' '),
            registrationAddress: addressLine,
            ip: params.buyerIp ?? '127.0.0.1',
            city,
            country: 'Turkey',
            zipCode: '34000',
          },
          shippingAddress: billingAddress,
          billingAddress,
          basketItems: [
            {
              id: params.plan,
              name: `Senkronize ${params.plan} Paketi`,
              category1: 'Yazılım',
              category2: 'Abonelik',
              itemType: Iyzipay.BASKET_ITEM_TYPE.VIRTUAL,
              price: priceStr,
            },
          ],
        },
        cb,
      );
    });

    const res = mapApiResponse(body);
    this.assertSuccess(res, 'checkout_initialize');
    const token = res.token;
    const checkoutFormContent = res.checkoutFormContent;
    if (!token || !checkoutFormContent) {
      throw new Error('iyzico_checkout_content_missing');
    }

    return {
      checkoutFormContent,
      token,
      tokenExpireTime: res.tokenExpireTime ?? Date.now() + 1_800_000,
      conversationId,
    };
  }

  async handleCallback(token: string): Promise<CheckoutCallbackResult> {
    const pending = await this.prisma.payment.findFirst({
      where: { iyzicoCheckoutToken: token, status: PaymentStatus.PENDING },
      orderBy: { createdAt: 'desc' },
    });
    const conversationId =
      pending?.iyzicoConversationId ?? `callback-${Date.now()}`;

    const body = await this.promisify<unknown>((cb) => {
      this.iyzipay.checkoutForm.retrieve(
        {
          locale: Iyzipay.LOCALE.TR,
          conversationId,
          token,
        },
        cb,
      );
    });
    const res = mapApiResponse(body);

    if (res.status !== 'success' || res.paymentStatus !== 'SUCCESS') {
      return {
        success: false,
        conversationId: res.conversationId ?? conversationId,
        orderId: res.paymentId ?? '',
        plan: pending?.plan ?? PlanTier.BASLANGIC,
        errorMessage: res.errorMessage ?? 'Ödeme doğrulanamadı',
      };
    }

    const parsed =
      parsePlanFromBasketId(res.basketId) ??
      (pending
        ? { plan: pending.plan, billingPeriod: pending.billingPeriod ?? undefined }
        : null);

    const paidPriceRaw = res.paidPrice ?? res.price ?? 0;
    const paidPriceTry =
      typeof paidPriceRaw === 'string'
        ? parseFloat(paidPriceRaw)
        : Number(paidPriceRaw);

    return {
      success: true,
      conversationId: res.conversationId ?? conversationId,
      orderId: res.paymentId ?? '',
      plan: parsed?.plan ?? pending?.plan ?? PlanTier.BASLANGIC,
      billingPeriod: parsed?.billingPeriod ?? pending?.billingPeriod ?? undefined,
      paidPriceTry: Number.isFinite(paidPriceTry) ? paidPriceTry : undefined,
      cardUserKey: res.cardUserKey,
      cardToken: res.cardToken,
      cardLastFour: res.lastFourDigits,
    };
  }

  async chargeWithStoredCard(
    params: StoredCardChargeParams,
  ): Promise<StoredCardChargeResult> {
    const priceStr = formatPriceTry(params.priceTry);
    const basketId = `${params.plan}-${params.billingPeriod}-${params.orgId}`;

    const body = await this.promisify<unknown>((cb) => {
      this.iyzipay.payment.create(
        {
          locale: Iyzipay.LOCALE.TR,
          conversationId: params.conversationId,
          price: priceStr,
          paidPrice: priceStr,
          currency: Iyzipay.CURRENCY.TRY,
          installment: 1,
          paymentChannel: Iyzipay.PAYMENT_CHANNEL.WEB,
          basketId,
          paymentGroup: Iyzipay.PAYMENT_GROUP.SUBSCRIPTION,
          paymentCard: {
            cardUserKey: params.cardUserKey,
            cardToken: params.cardToken,
          },
          buyer: params.buyer,
          shippingAddress: params.billingAddress,
          billingAddress: params.billingAddress,
          basketItems: [
            {
              id: params.plan,
              name: `Senkronize ${params.plan} Paketi`,
              category1: 'Yazılım',
              category2: 'Abonelik',
              itemType: Iyzipay.BASKET_ITEM_TYPE.VIRTUAL,
              price: priceStr,
            },
          ],
        },
        cb,
      );
    });

    const res = mapApiResponse(body);
    this.assertSuccess(res, 'stored_card_payment');
    const paymentId = res.paymentId;
    if (!paymentId) {
      throw new Error('iyzico_payment_id_missing');
    }

    const paidRaw = res.paidPrice ?? params.priceTry;
    const paidPriceTry =
      typeof paidRaw === 'string' ? parseFloat(paidRaw) : Number(paidRaw);

    return {
      paymentId,
      paidPriceTry: Number.isFinite(paidPriceTry) ? paidPriceTry : params.priceTry,
    };
  }

  async renewSubscription(orgId: string): Promise<void> {
    const iyzicoSub = await this.prisma.iyzicoSubscription.findUnique({
      where: { organizationId: orgId },
    });
    if (!iyzicoSub?.cardUserKeyEnc || !iyzicoSub.cardTokenEnc) {
      throw new NotFoundException('Kayıtlı kart bulunamadı');
    }

    const subscription = await this.prisma.subscription.findUnique({
      where: { organizationId: orgId },
    });
    if (!subscription) {
      throw new NotFoundException('Abonelik bulunamadı');
    }

    const owner = await this.prisma.user.findFirst({
      where: { organizationId: orgId, role: UserRole.OWNER, deletedAt: null },
    });
    const org = await this.prisma.organization.findFirst({
      where: { id: orgId, deletedAt: null },
    });
    if (!owner || !org) {
      throw new NotFoundException('Organizasyon veya kullanıcı bulunamadı');
    }

    const cardUserKey = this.encryptionService.decrypt(iyzicoSub.cardUserKeyEnc);
    const cardToken = this.encryptionService.decrypt(iyzicoSub.cardTokenEnc);
    const billingPeriod = subscription.billingPeriod ?? BillingPeriod.YEARLY;
    const priceTry = this.renewalPriceTry(subscription.plan, billingPeriod);
    const customer = this.buildCustomerPayload(owner, org);

    await this.chargeWithStoredCard({
      conversationId: `${orgId}-renew-${Date.now()}`,
      orgId,
      plan: subscription.plan,
      billingPeriod,
      priceTry,
      cardUserKey,
      cardToken,
      buyer: {
        id: owner.id,
        name: customer.name,
        surname: customer.surname,
        email: customer.email,
        gsmNumber: customer.gsmNumber,
        identityNumber: customer.identityNumber,
        city: customer.billingAddress.city,
        country: customer.billingAddress.country,
        address: customer.billingAddress.address,
        zipCode: customer.billingAddress.zipCode,
      },
      billingAddress: customer.billingAddress,
    });
  }

  async saveCard(userId: string, checkoutToken: string): Promise<void> {
    const callback = await this.handleCallback(checkoutToken);
    if (!callback.success || !callback.cardUserKey || !callback.cardToken) {
      throw new Error('iyzico_card_save_failed');
    }

    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });
    if (!user?.organizationId) {
      throw new NotFoundException('Kullanıcı bulunamadı');
    }

    await this.prisma.iyzicoSubscription.upsert({
      where: { organizationId: user.organizationId },
      create: {
        organizationId: user.organizationId,
        cardUserKeyEnc: this.encryptionService.encrypt(callback.cardUserKey),
        cardTokenEnc: this.encryptionService.encrypt(callback.cardToken),
        cardLastFour: callback.cardLastFour ?? null,
      },
      update: {
        cardUserKeyEnc: this.encryptionService.encrypt(callback.cardUserKey),
        cardTokenEnc: this.encryptionService.encrypt(callback.cardToken),
        cardLastFour: callback.cardLastFour ?? null,
      },
    });
  }

  async deleteCard(cardToken: string, organizationId: string): Promise<void> {
    const iyzicoSub = await this.prisma.iyzicoSubscription.findUnique({
      where: { organizationId },
    });
    if (!iyzicoSub?.cardUserKeyEnc) {
      return;
    }

    const cardUserKey = this.encryptionService.decrypt(iyzicoSub.cardUserKeyEnc);
    const body = await this.promisify<unknown>((cb) => {
      this.iyzipay.card.delete(
        {
          locale: Iyzipay.LOCALE.TR,
          conversationId: `card-del-${Date.now()}`,
          cardUserKey,
          cardToken,
        },
        cb,
      );
    });
    const res = mapApiResponse(body);
    this.assertSuccess(res, 'card_delete');

    await this.prisma.iyzicoSubscription.update({
      where: { organizationId },
      data: {
        cardTokenEnc: null,
        cardLastFour: null,
      },
    });
  }

  private renewalPriceTry(plan: PlanTier, billingPeriod: BillingPeriod): number {
    const yearlyKurus: Record<PlanTier, number> = {
      BASLANGIC: 290_000,
      GELISIM: 590_000,
      PRO: 990_000,
      KURUMSAL: 1_990_000,
    };
    const yearly = yearlyKurus[plan] / 100;
    if (billingPeriod === BillingPeriod.YEARLY) {
      return yearly;
    }
    return Math.round((yearly / 12) * 100) / 100;
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
