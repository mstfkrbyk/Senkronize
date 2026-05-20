/**
 * xml2js çıktısı için gevşek tipler (N11 SOAP yanıtı mağaza / sürüme göre değişebilir).
 */
export interface N11SoapResult {
  status?: string;
  errorCode?: string;
  errorMessage?: string;
}

export interface N11OrderItemXml {
  id?: string;
  productSellerCode?: string;
  productName?: string;
  quantity?: string | number;
  price?: string | number;
}

export interface N11OrderXml {
  id?: string;
  orderNumber?: string;
  status?: string | number;
  createDate?: string;
  totalAmount?: string | number;
  buyer?: {
    fullName?: string;
    name?: string;
  };
  shippingAddress?: {
    address?: string;
    fullAddress?: string;
    city?: string;
    district?: string;
  };
  orderItemList?: {
    orderItem?: N11OrderItemXml | N11OrderItemXml[];
  };
}

export interface N11ProductXml {
  id?: string;
  productSellerCode?: string;
  title?: string;
  barcode?: string;
  quantity?: string | number;
  price?: string | number;
  displayPrice?: string | number;
  saleStatus?: string;
  approvalStatus?: string | number;
  images?: {
    image?: { url?: string } | Array<{ url?: string }>;
  };
}
