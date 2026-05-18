/** Cdiscount SOAP yanıtından ayıklanan sipariş özeti */
export interface CdiscountParsedOrder {
  orderId: string;
  status?: string;
  createdAt?: string;
  total?: string;
  currency?: string;
}
