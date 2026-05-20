import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { UserRole } from '@prisma/client';
import { Server, Socket } from 'socket.io';

import { JwtPayload } from '../auth/auth.types';

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

@WebSocketGateway({
  cors: {
    origin: process.env.APP_URL ?? 'http://localhost:5173',
    credentials: true,
  },
})
export class NotificationGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server!: Server;

  private readonly logger = new Logger(NotificationGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  private resolveAccessToken(client: Socket): string | undefined {
    const auth = client.handshake.auth;
    if (auth && typeof auth === 'object' && 'token' in auth) {
      const t = (auth as { token?: unknown }).token;
      if (typeof t === 'string' && t.length > 0) {
        return t;
      }
    }
    const raw = client.handshake.headers.authorization;
    if (typeof raw === 'string' && raw.startsWith('Bearer ')) {
      return raw.slice('Bearer '.length).trim();
    }
    return undefined;
  }

  async handleConnection(client: Socket): Promise<void> {
    const token = this.resolveAccessToken(client);
    if (!token) {
      client.disconnect();
      return;
    }
    try {
      const payload = this.jwtService.verify<JwtPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
      });
      const orgId: string =
        (payload.impersonatedOrgId as string | undefined) ??
        (payload.orgId as string);
      const userId = payload.sub as string;
      const role = payload.role as string;

      client.data.orgId = orgId;
      client.data.userId = userId;
      client.data.role = role;

      await client.join(`org:${orgId}`);
      await client.join(`user:${userId}`);

      if (role === UserRole.SUPER_ADMIN) {
        await client.join('admin');
      }

      this.logger.log(
        `Client connected: userId=${userId}, org=${orgId}, role=${role}`,
      );
    } catch (error) {
      this.logger.warn('WebSocket kimlik doğrulaması başarısız', {
        socketId: client.id,
        message: error instanceof Error ? error.message : 'unknown',
      });
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('sync:trigger')
  handleSyncTrigger(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { platform?: string },
  ): void {
    if (!data?.platform || typeof data.platform !== 'string') {
      return;
    }
    this.logger.log(
      `Sync trigger from org:${String(client.data.orgId)}, platform: ${data.platform}`,
    );
  }

  emitToOrg(orgId: string, event: string, data: unknown): void {
    this.server.to(`org:${orgId}`).emit(event, data);
  }

  emitToUser(userId: string, event: string, data: unknown): void {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  emitToAdmin(event: string, data: unknown): void {
    this.server.to('admin').emit(event, data);
  }

  emitOrderNew(orgId: string, payload: OrderNewPayload): void {
    this.emitToOrg(orgId, NOTIFICATION_WS_EVENTS.ORDER_NEW, payload);
  }

  emitOrderStatusChanged(orgId: string, payload: OrderStatusChangedPayload): void {
    this.emitToOrg(orgId, NOTIFICATION_WS_EVENTS.ORDER_STATUS_CHANGED, payload);
  }

  emitStockLow(orgId: string, payload: StockLowPayload): void {
    this.emitToOrg(orgId, NOTIFICATION_WS_EVENTS.STOCK_LOW, payload);
  }

  emitStockOut(orgId: string, payload: StockOutPayload): void {
    this.emitToOrg(orgId, NOTIFICATION_WS_EVENTS.STOCK_OUT, payload);
  }

  emitSyncProgress(orgId: string, payload: SyncProgressPayload): void {
    this.emitToOrg(orgId, NOTIFICATION_WS_EVENTS.SYNC_PROGRESS, payload);
  }

  emitSyncCompleted(orgId: string, payload: SyncCompletedPayload): void {
    this.emitToOrg(orgId, NOTIFICATION_WS_EVENTS.SYNC_COMPLETED, payload);
  }

  emitSyncError(orgId: string, payload: SyncErrorPayload): void {
    this.emitToOrg(orgId, NOTIFICATION_WS_EVENTS.SYNC_ERROR, payload);
  }

  emitBuyBoxLost(orgId: string, payload: BuyBoxLostPayload): void {
    this.emitToOrg(orgId, NOTIFICATION_WS_EVENTS.BUYBOX_LOST, payload);
  }

  emitBuyBoxWon(orgId: string, payload: BuyBoxWonPayload): void {
    this.emitToOrg(orgId, NOTIFICATION_WS_EVENTS.BUYBOX_WON, payload);
  }

  emitInAppNotification(userId: string, payload: InAppNotificationPayload): void {
    this.emitToUser(userId, NOTIFICATION_WS_EVENTS.NOTIFICATION, payload);
  }
}
