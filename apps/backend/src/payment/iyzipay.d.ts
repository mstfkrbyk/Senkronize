declare module 'iyzipay' {
  interface IyzipayConfig {
    apiKey: string;
    secretKey: string;
    uri: string;
  }

  interface IyzipayCallback<T> {
    (err: Error | null, result: T): void;
  }

  interface IyzipayResource {
    create(params: Record<string, unknown>, cb: IyzipayCallback<unknown>): void;
    retrieve(params: Record<string, unknown>, cb: IyzipayCallback<unknown>): void;
    retrieveList(params: Record<string, unknown>, cb: IyzipayCallback<unknown>): void;
    update(params: Record<string, unknown>, cb: IyzipayCallback<unknown>): void;
    delete(params: Record<string, unknown>, cb: IyzipayCallback<unknown>): void;
    initialize(params: Record<string, unknown>, cb: IyzipayCallback<unknown>): void;
    cancel(params: Record<string, unknown>, cb: IyzipayCallback<unknown>): void;
    upgrade(params: Record<string, unknown>, cb: IyzipayCallback<unknown>): void;
  }

  class Iyzipay {
    constructor(config: IyzipayConfig);
    subscriptionProduct: IyzipayResource;
    subscriptionPricingPlan: IyzipayResource;
    subscriptionCustomer: IyzipayResource;
    subscriptionCheckoutForm: IyzipayResource;
    subscription: IyzipayResource;
    subscriptionExistingCustomer: IyzipayResource;
    static LOCALE: { TR: string; EN: string };
    static SUBSCRIPTION_PRICING_PLAN_INTERVAL: {
      DAILY: string;
      WEEKLY: string;
      MONTHLY: string;
      YEARLY: string;
    };
    static SUBSCRIPTION_UPGRADE_PERIOD: { NOW: string; NEXT_PERIOD: string };
    static SUBSCRIPTION_INITIAL_STATUS: { ACTIVE: string; PENDING: string };
    static PLAN_PAYMENT_TYPE: { RECURRING: string };
  }

  export = Iyzipay;
}
