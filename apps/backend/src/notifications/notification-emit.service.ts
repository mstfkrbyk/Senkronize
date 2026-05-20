import { Injectable } from '@nestjs/common';

import { WS_EVENTS, type WsEventName } from '../event/event.types';

import { NotificationGateway } from './notification.gateway';
import {
  NOTIFICATION_WS_EVENTS,
  type BuyBoxLostPayload,
  type BuyBoxWonPayload,
  type InAppNotificationPayload,
  type OrderNewPayload,
  type OrderStatusChangedPayload,
  type StockLowPayload,
  type StockOutPayload,
  type SyncCompletedPayload,
  type SyncErrorPayload,
  type SyncProgressPayload,
} from './notification.gateway.types';

const LEGACY_EVENT_MAP: Partial<Record<WsEventName, string>> = {
  [WS_EVENTS.ORDER_NEW]: NOTIFICATION_WS_EVENTS.ORDER_NEW,
  [WS_EVENTS.ORDER_UPDATED]: NOTIFICATION_WS_EVENTS.ORDER_STATUS_CHANGED,
  [WS_EVENTS.STOCK_ALERT]: NOTIFICATION_WS_EVENTS.STOCK_LOW,
  [WS_EVENTS.STOCK_UPDATED]: NOTIFICATION_WS_EVENTS.STOCK_LOW,
  [WS_EVENTS.SYNC_COMPLETED]: NOTIFICATION_WS_EVENTS.SYNC_COMPLETED,
  [WS_EVENTS.SYNC_ERROR]: NOTIFICATION_WS_EVENTS.SYNC_ERROR,
  [WS_EVENTS.NOTIFICATION_NEW]: NOTIFICATION_WS_EVENTS.NOTIFICATION,
  [WS_EVENTS.PRICE_UPDATED]: 'price.updated',
  [WS_EVENTS.LISTING_SYNCED]: 'listing.synced',
  [WS_EVENTS.SYNC_STATUS]: 'sync.status',
  [WS_EVENTS.DASHBOARD_UPDATE]: 'dashboard.update',
};

@Injectable()
export class NotificationEmitService {
  constructor(private readonly gateway: NotificationGateway) {}

  emitLegacy(orgId: string, event: WsEventName, data: unknown): void {
    const mapped = LEGACY_EVENT_MAP[event] ?? event;
    this.gateway.emitToOrg(orgId, mapped, data);
  }

  emitOrderNew(orgId: string, payload: OrderNewPayload): void {
    this.gateway.emitOrderNew(orgId, payload);
  }

  emitOrderStatusChanged(orgId: string, payload: OrderStatusChangedPayload): void {
    this.gateway.emitOrderStatusChanged(orgId, payload);
  }

  emitStockLow(orgId: string, payload: StockLowPayload): void {
    this.gateway.emitStockLow(orgId, payload);
  }

  emitStockOut(orgId: string, payload: StockOutPayload): void {
    this.gateway.emitStockOut(orgId, payload);
  }

  emitSyncProgress(orgId: string, payload: SyncProgressPayload): void {
    this.gateway.emitSyncProgress(orgId, payload);
  }

  emitSyncCompleted(orgId: string, payload: SyncCompletedPayload): void {
    this.gateway.emitSyncCompleted(orgId, payload);
  }

  emitSyncError(orgId: string, payload: SyncErrorPayload): void {
    this.gateway.emitSyncError(orgId, payload);
  }

  emitBuyBoxLost(orgId: string, payload: BuyBoxLostPayload): void {
    this.gateway.emitBuyBoxLost(orgId, payload);
  }

  emitBuyBoxWon(orgId: string, payload: BuyBoxWonPayload): void {
    this.gateway.emitBuyBoxWon(orgId, payload);
  }

  emitInAppNotification(userId: string, payload: InAppNotificationPayload): void {
    this.gateway.emitInAppNotification(userId, payload);
  }
}
