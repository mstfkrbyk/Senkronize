export interface ConnectionPushSettings {
  pushStock: boolean;
  pushPrice: boolean;
}

export interface ProductPushSettings {
  pushStockEnabled: boolean | null;
  pushPriceEnabled: boolean | null;
}

export function isStockPushEnabled(
  connection: ConnectionPushSettings,
  product?: ProductPushSettings | null,
): boolean {
  if (!connection.pushStock) {
    return false;
  }
  if (product?.pushStockEnabled === false) {
    return false;
  }
  return true;
}

export function isPricePushEnabled(
  connection: ConnectionPushSettings,
  product?: ProductPushSettings | null,
): boolean {
  if (!connection.pushPrice) {
    return false;
  }
  if (product?.pushPriceEnabled === false) {
    return false;
  }
  return true;
}
