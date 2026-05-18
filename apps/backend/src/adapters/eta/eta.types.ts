/** ETA token yanıtı (kuruluma göre alan adları değişebilir) */
export interface EtaTokenResponse {
  token?: string;
  access_token?: string;
  expiresIn?: number;
}

export interface EtaInvoiceCreateResponse {
  id?: string;
  invoiceId?: string;
  invoiceNumber?: string;
  number?: string;
  invoiceNo?: string;
}
