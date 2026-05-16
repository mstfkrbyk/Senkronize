export interface PaytrIframeParams {
  merchantId: string;
  userIp: string;
  merchantOid: string;
  email: string;
  paymentAmount: number;
  currency: 'TL';
  testMode: '0' | '1';
  noInstallment: '0' | '1';
  maxInstallment: '0';
  userName: string;
  userAddress: string;
  userPhone: string;
  okUrl: string;
  failUrl: string;
  cardType?: string;
  lang: 'tr';
  installmentCount: '0';
  paytrToken: string;
  debugOn: '0' | '1';
  clientLang: 'tr';
  recurringPayment: '1';
  recurringPeriod: 'Monthly';
  recurringPaymentCount: '0';
  recurringPaymentAmount?: number;
}

export interface PaytrWebhookPayload {
  merchant_oid: string;
  status: 'success' | 'failed';
  total_amount: string;
  hash: string;
  payment_type?: string;
  currency?: string;
  test_mode?: string;
  payment_amount?: string;
  failed_reason_code?: string;
  failed_reason_msg?: string;
  fail_reason_code?: string;
  fail_reason_msg?: string;
  recurring_id?: string;
  card_type?: string;
  utoken?: string;
  ctoken?: string;
}
