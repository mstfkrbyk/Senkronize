export interface AllegroTokenResponse {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
}

export interface AllegroCheckoutFormBuyer {
  id?: string;
  email?: string;
  login?: string;
}

export interface AllegroCheckoutForm {
  id?: string;
  status?: string;
  buyer?: AllegroCheckoutFormBuyer;
  updatedAt?: string;
  lineItems?: Array<{
    id?: string;
    offer?: { id?: string; name?: string };
    quantity?: number;
    price?: { amount?: string; currency?: string };
  }>;
  summary?: {
    totalToPay?: { amount?: string; currency?: string };
  };
}

export interface AllegroCheckoutFormsResponse {
  checkoutForms?: AllegroCheckoutForm[];
  count?: number;
  totalCount?: number;
}

export interface AllegroOfferListing {
  id?: string;
  name?: string;
  publication?: { status?: string };
  stock?: { available?: number; unit?: string };
  sellingMode?: {
    price?: { amount?: string; currency?: string };
    format?: string;
  };
}

export interface AllegroOffersListingResponse {
  offers?: AllegroOfferListing[];
  count?: number;
  totalCount?: number;
}
