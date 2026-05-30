function readString(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.trim().length > 0) {
      return v.trim();
    }
    if (typeof v === 'number' && Number.isFinite(v)) {
      return String(v).trim();
    }
  }
  return undefined;
}

export function extractN11EventType(payload: unknown): string {
  if (typeof payload !== 'object' || payload === null) {
    return 'UNKNOWN';
  }
  const o = payload as Record<string, unknown>;
  const raw =
    readString(o, ['eventType', 'EventType', 'event', 'type']) ??
    (typeof o.order === 'object' && o.order !== null
      ? readString(o.order as Record<string, unknown>, ['eventType', 'type'])
      : undefined);
  return raw ?? 'UNKNOWN';
}

/** n11 sipariş webhook: platformOrderId ve ham durum metni. */
export function extractN11OrderStatus(payload: unknown): {
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
    'orderId',
    'OrderId',
    'orderNumber',
    'OrderNumber',
    'id',
    'Id',
  ]);
  const status = readString(nested, [
    'status',
    'Status',
    'orderStatus',
    'OrderStatus',
  ]);
  return { platformOrderId, status };
}
