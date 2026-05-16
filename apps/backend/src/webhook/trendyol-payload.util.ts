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
} {
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
  return {
    platformOrderId:
      id !== undefined && id !== null ? String(id) : undefined,
    status: typeof status === 'string' ? status : undefined,
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
