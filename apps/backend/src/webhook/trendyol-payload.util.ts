/** Trendyol ORDER_STATUS_CHANGED webhook gövdesi */
export interface TrendyolOrderStatusWebhook {
  type: 'ORDER_STATUS_CHANGED';
  orderId: string;
  status:
    | 'Created'
    | 'Picking'
    | 'Invoiced'
    | 'Shipped'
    | 'Delivered'
    | 'Cancelled';
  shipmentTrackingNumber?: string;
}

const TRENDYOL_ORDER_STATUS_VALUES = new Set([
  'Created',
  'Picking',
  'Invoiced',
  'Shipped',
  'Delivered',
  'Cancelled',
]);

function isTrendyolOrderStatus(value: string): value is TrendyolOrderStatusWebhook['status'] {
  return TRENDYOL_ORDER_STATUS_VALUES.has(value);
}

export function parseTrendyolOrderStatusWebhook(
  payload: unknown,
): TrendyolOrderStatusWebhook | null {
  if (typeof payload !== 'object' || payload === null) {
    return null;
  }
  const o = payload as Record<string, unknown>;
  const rawType = o.type ?? o.eventType ?? o.event;
  const type =
    typeof rawType === 'string' ? rawType.trim().toUpperCase() : '';
  if (type !== 'ORDER_STATUS_CHANGED') {
    return null;
  }
  const orderIdRaw = o.orderId ?? o.orderNumber ?? o.shipmentPackageId;
  if (orderIdRaw === undefined || orderIdRaw === null) {
    return null;
  }
  const statusRaw = o.status ?? o.orderStatus;
  if (typeof statusRaw !== 'string' || !isTrendyolOrderStatus(statusRaw)) {
    return null;
  }
  const tracking =
    typeof o.shipmentTrackingNumber === 'string'
      ? o.shipmentTrackingNumber.trim()
      : typeof o.trackingNumber === 'string'
        ? o.trackingNumber.trim()
        : undefined;
  return {
    type: 'ORDER_STATUS_CHANGED',
    orderId: String(orderIdRaw),
    status: statusRaw,
    ...(tracking && tracking.length > 0
      ? { shipmentTrackingNumber: tracking }
      : {}),
  };
}

export function extractTrendyolEventType(payload: unknown): string {
  if (typeof payload !== 'object' || payload === null) {
    return 'UNKNOWN';
  }
  const o = payload as Record<string, unknown>;
  const t = o.eventType ?? o.type ?? o.event ?? o.EventType;
  return typeof t === 'string' ? t : 'UNKNOWN';
}

export function extractOrderIdentifiers(payload: unknown): {
  platformOrderId?: string;
  status?: string;
  shipmentTrackingNumber?: string;
} {
  const typed = parseTrendyolOrderStatusWebhook(payload);
  if (typed) {
    return {
      platformOrderId: typed.orderId,
      status: typed.status,
      shipmentTrackingNumber: typed.shipmentTrackingNumber,
    };
  }
  if (typeof payload !== 'object' || payload === null) {
    return {};
  }
  const o = payload as Record<string, unknown>;
  const id =
    o.orderId ??
    o.orderNumber ??
    o.shipmentPackageId ??
    o.packageId ??
    o.id;
  let status: unknown = o.status ?? o.orderStatus;
  if (
    status === undefined &&
    typeof o.order === 'object' &&
    o.order !== null &&
    'status' in o.order
  ) {
    status = (o.order as Record<string, unknown>).status;
  }
  const tracking =
    typeof o.shipmentTrackingNumber === 'string'
      ? o.shipmentTrackingNumber
      : typeof o.trackingNumber === 'string'
        ? o.trackingNumber
        : undefined;
  return {
    platformOrderId:
      id !== undefined && id !== null ? String(id) : undefined,
    status: typeof status === 'string' ? status : undefined,
    shipmentTrackingNumber: tracking,
  };
}

export function extractProductIdentifiers(payload: unknown): {
  platformProductId?: string;
  barcode?: string;
} {
  if (typeof payload !== 'object' || payload === null) {
    return {};
  }
  const o = payload as Record<string, unknown>;
  const pid =
    o.productMainId ??
    o.productId ??
    o.platformProductId ??
    o.mainId ??
    o.id;
  const barcode = o.barcode ?? o.productBarcode;
  return {
    platformProductId:
      pid !== undefined && pid !== null ? String(pid) : undefined,
    barcode: typeof barcode === 'string' ? barcode : undefined,
  };
}
