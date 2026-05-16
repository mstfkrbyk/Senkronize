import { createHmac } from 'node:crypto';

import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

import type { PaytrWebhookPayload } from './paytr.types';

const PAYTR_GET_TOKEN_URL = 'https://www.paytr.com/odeme/api/get-token';

export interface PaytrGetTokenInput {
  userIp: string;
  merchantOid: string;
  email: string;
  paymentAmountKurus: number;
  userName: string;
  userAddress: string;
  userPhone: string;
  planLabel: string;
}

export interface PaytrGetTokenResult {
  iframeToken: string;
  merchantOid: string;
}

@Injectable()
export class PaytrService {
  private readonly logger = new Logger(PaytrService.name);
  private readonly merchantId: string;
  private readonly merchantKey: string;
  private readonly merchantSalt: string;

  constructor(
    private readonly config: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.merchantId = this.config.getOrThrow('PAYTR_MERCHANT_ID');
    this.merchantKey = this.config.getOrThrow('PAYTR_MERCHANT_KEY');
    this.merchantSalt = this.config.getOrThrow('PAYTR_MERCHANT_SALT');
  }

  /**
   * PayTR iFrame API 1. adım — resmi örnekteki sıra ve HMAC (hash_str + salt, anahtar merchant_key).
   */
  generateIframeToken(params: {
    merchantId: string;
    userIp: string;
    merchantOid: string;
    email: string;
    paymentAmount: number;
    userBasketB64: string;
    currency: string;
    testMode: '0' | '1';
    noInstallment: '0' | '1';
    maxInstallment: '0';
  }): string {
    const hashStr =
      params.merchantId +
      params.userIp +
      params.merchantOid +
      params.email +
      String(params.paymentAmount) +
      params.userBasketB64 +
      params.noInstallment +
      params.maxInstallment +
      params.currency +
      params.testMode;
    return createHmac('sha256', this.merchantKey)
      .update(hashStr + this.merchantSalt)
      .digest('base64');
  }

  verifyWebhookHash(payload: PaytrWebhookPayload): boolean {
    const hashStr =
      payload.merchant_oid +
      this.merchantSalt +
      payload.status +
      payload.total_amount;
    const expected = createHmac('sha256', this.merchantKey)
      .update(hashStr)
      .digest('base64');
    return expected === payload.hash;
  }

  /**
   * PayTR merchant_oid: en fazla 64 karakter, yalnızca harf ve rakam.
   */
  generateOrderId(): string {
    const ts = Date.now().toString(36);
    const rnd = Math.random().toString(36).slice(2, 10);
    const oid = `SKR${ts}${rnd}`.replace(/[^a-zA-Z0-9]/g, '').slice(0, 64);
    return oid.length > 0 ? oid : `SKR${Date.now()}`;
  }

  buildUserBasketBase64(planLabel: string, amountKurus: number): string {
    const amountTry = (amountKurus / 100).toFixed(2);
    const basket = [[planLabel, amountTry, 1]];
    return Buffer.from(JSON.stringify(basket), 'utf8').toString('base64');
  }

  async requestIframeToken(input: PaytrGetTokenInput): Promise<PaytrGetTokenResult> {
    const testMode = this.config.get<string>('PAYTR_TEST_MODE') === '1' ? '1' : '0';
    const okUrl = this.config.getOrThrow<string>('PAYTR_OK_URL');
    const failUrl = this.config.getOrThrow<string>('PAYTR_FAIL_URL');
    const userBasketB64 = this.buildUserBasketBase64(
      input.planLabel,
      input.paymentAmountKurus,
    );
    const currency = 'TL';
    const noInstallment = '1';
    const maxInstallment = '0';
    const paytrToken = this.generateIframeToken({
      merchantId: this.merchantId,
      userIp: input.userIp,
      merchantOid: input.merchantOid,
      email: input.email,
      paymentAmount: input.paymentAmountKurus,
      userBasketB64,
      currency,
      testMode: testMode as '0' | '1',
      noInstallment: noInstallment as '0' | '1',
      maxInstallment: maxInstallment as '0',
    });

    const body = new URLSearchParams();
    body.set('merchant_id', this.merchantId);
    body.set('user_ip', input.userIp);
    body.set('merchant_oid', input.merchantOid);
    body.set('email', input.email);
    body.set('payment_amount', String(input.paymentAmountKurus));
    body.set('user_basket', userBasketB64);
    body.set('no_installment', noInstallment);
    body.set('max_installment', maxInstallment);
    body.set('currency', currency);
    body.set('test_mode', testMode);
    body.set('user_name', input.userName);
    body.set('user_address', input.userAddress);
    body.set('user_phone', input.userPhone);
    body.set('merchant_ok_url', okUrl);
    body.set('merchant_fail_url', failUrl);
    body.set('timeout_limit', '30');
    body.set('lang', 'tr');
    body.set('debug_on', testMode === '1' ? '1' : '0');
    body.set('paytr_token', paytrToken);
    body.set('recurring_payment', '1');
    body.set('recurring_period', 'Monthly');
    body.set('recurring_payment_count', '0');
    body.set(
      'recurring_payment_amount',
      String(input.paymentAmountKurus),
    );

    try {
      const { data } = await firstValueFrom(
        this.httpService.post<{
          status: string;
          token?: string;
          reason?: string;
        }>(PAYTR_GET_TOKEN_URL, body.toString(), {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          maxRedirects: 0,
          validateStatus: () => true,
        }),
      );
      if (data.status !== 'success' || !data.token) {
        this.logger.warn('PayTR get-token başarısız', {
          status: data.status,
          reason: data.reason,
        });
        throw new Error(data.reason ?? 'PayTR get-token başarısız');
      }
      return { iframeToken: data.token, merchantOid: input.merchantOid };
    } catch (err) {
      this.logger.error('PayTR get-token isteği hatası', { err });
      throw err;
    }
  }
}
