export interface EbaTokenResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
}

export interface EbaInvoiceCreateResponse {
  id?: string;
  documentId?: string;
  invoiceNumber?: string;
  number?: string;
}
