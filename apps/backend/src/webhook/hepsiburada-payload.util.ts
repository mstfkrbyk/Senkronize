function readString(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.trim().length > 0) {
      return v.trim();
    }
  }
  return undefined;
}

export function extractHepsiburadaEventType(payload: unknown): string {
  if (typeof payload !== 'object' || payload === null) {
    return 'UNKNOWN';
  }
  const o = payload as Record<string, unknown>;
  const raw =
    readString(o, ['eventType', 'EventType', 'type', 'event', 'EventName']) ??
    (typeof o.event === 'object' && o.event !== null
      ? readString(o.event as Record<string, unknown>, ['type', 'eventType'])
      : undefined);
  if (!raw) {
    return 'UNKNOWN';
  }
  return raw.trim().toUpperCase();
}

/** Sipariş numarası ve durum (ORDER_STATUS_UPDATE). */
export function extractHepsiburadaOrderStatus(payload: unknown): {
  platformOrderId?: string;
  status?: string;
} {
  if (typeof payload !== 'object' || payload === null) {
    return {};
  }
  const o = payload as Record<string, unknown>;
  const nested =
    typeof o.order === 'object' && o.order !== null
      ? (o.order as Record<string, unknown>)
      : o;
  const platformOrderId = readString(nested, [
    'orderNumber',
    'OrderNumber',
    'orderId',
    'OrderId',
    'merchantOrderNumber',
    'MerchantOrderNumber',
    'packageNumber',
    'PackageNumber',
  ]);
  const status = readString(nested, [
    'status',
    'Status',
    'orderStatus',
    'OrderStatus',
    'packageStatus',
    'PackageStatus',
  ]);
  return { platformOrderId, status };
}

/** Kargo takip (CARGO_TRACKING). */
export function extractHepsiburadaCargo(payload: unknown): {
  platformOrderId?: string;
  trackingNumber?: string;
  cargoCompany?: string;
} {
  if (typeof payload !== 'object' || payload === null) {
    return {};
  }
  const o = payload as Record<string, unknown>;
  const nested =
    typeof o.package === 'object' && o.package !== null
      ? (o.package as Record<string, unknown>)
      : typeof o.cargo === 'object' && o.cargo !== null
        ? (o.cargo as Record<string, unknown>)
        : o;
  const platformOrderId = readString(nested, [
    'orderNumber',
    'OrderNumber',
    'orderId',
    'OrderId',
    'packageNumber',
    'PackageNumber',
  ]);
  const trackingNumber = readString(nested, [
    'trackingNumber',
    'TrackingNumber',
    'cargoTrackingNumber',
    'barcode',
    'Barcode',
  ]);
  const cargoCompany = readString(nested, [
    'cargoCompany',
    'CargoCompany',
    'cargoProvider',
    'CargoProvider',
    'carrier',
    'Carrier',
  ]);
  return { platformOrderId, trackingNumber, cargoCompany };
}
