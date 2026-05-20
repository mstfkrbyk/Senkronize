import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { NotificationGateway } from '../notifications/notification.gateway';

import { DASHBOARD_WS_EVENTS } from './dashboard.gateway.types';
import { DashboardService } from './dashboard.service';
import type {
  DashboardKpiUpdatePayload,
  DashboardKpisResponse,
  DashboardOrderNewPayload,
  DashboardStockAlertPayload,
} from './dashboard.types';

@Injectable()
export class DashboardGateway {
  private readonly logger = new Logger(DashboardGateway.name);

  constructor(
    private readonly notificationGateway: NotificationGateway,
    private readonly dashboardService: DashboardService,
  ) {}

  emitOrderNew(orgId: string, payload: DashboardOrderNewPayload): void {
    this.notificationGateway.emitToOrg(
      orgId,
      DASHBOARD_WS_EVENTS.ORDER_NEW,
      payload,
    );
  }

  emitKpiUpdate(orgId: string, payload: DashboardKpiUpdatePayload): void {
    this.notificationGateway.emitToOrg(
      orgId,
      DASHBOARD_WS_EVENTS.KPI_UPDATE,
      payload,
    );
  }

  emitStockAlert(orgId: string, payload: DashboardStockAlertPayload): void {
    this.notificationGateway.emitToOrg(
      orgId,
      DASHBOARD_WS_EVENTS.STOCK_ALERT,
      payload,
    );
  }

  async broadcastKpisForOrg(
    orgId: string,
    period: '7d' | '30d' | '90d' = '7d',
  ): Promise<DashboardKpisResponse> {
    const kpis = await this.dashboardService.getKpis(orgId, period);
    this.emitKpiUpdate(orgId, {
      period,
      kpis,
      emittedAt: new Date().toISOString(),
    });
    return kpis;
  }

  @Cron('*/5 * * * *')
  async broadcastKpiUpdates(): Promise<void> {
    const server = this.notificationGateway.server;
    if (!server) {
      return;
    }

    const orgIds = new Set<string>();
    for (const room of server.sockets.adapter.rooms.keys()) {
      if (room.startsWith('org:')) {
        orgIds.add(room.slice(4));
      }
    }

    if (orgIds.size === 0) {
      return;
    }

    this.logger.debug(
      `Canlı KPI güncellemesi: ${String(orgIds.size)} organizasyon`,
    );

    await Promise.all(
      Array.from(orgIds).map(async (orgId) => {
        try {
          await this.broadcastKpisForOrg(orgId, '7d');
        } catch (error) {
          this.logger.warn('KPI broadcast başarısız', {
            organizationId: orgId,
            message: error instanceof Error ? error.message : 'unknown',
          });
        }
      }),
    );
  }
}
