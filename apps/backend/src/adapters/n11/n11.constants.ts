/** N11 SOAP servis kökü */
export const N11_WSDL_BASE = 'https://api.n11.com/ws';

export const N11_ORDER_WSDL = `${N11_WSDL_BASE}/OrderService.wsdl`;

/** Stok/fiyat güncelleme — ProductService SOAP */
export const N11_PRODUCT_WSDL = `${N11_WSDL_BASE}/ProductService.wsdl`;

/** Eski stok servisi (geriye dönük referans) */
export const N11_PRODUCT_STOCK_WSDL = `${N11_WSDL_BASE}/productStockService.wsdl`;

/** Ürün kataloğu: GetProductList, SaveProduct */
export const N11_CATALOG_SERVICE_WSDL = `${N11_WSDL_BASE}/ProductService.wsdl`;
