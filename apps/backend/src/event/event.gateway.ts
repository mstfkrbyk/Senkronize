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
import { Server, Socket } from 'socket.io';
import { JwtPayload } from '../auth/auth.types';

@WebSocketGateway({
  cors: {
    origin: process.env.APP_URL ?? 'http://localhost:5173',
    credentials: true,
  },
})
export class EventGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;

  private readonly logger = new Logger(EventGateway.name);

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
      client.data.orgId = orgId;
      client.data.userId = payload.sub as string;
      await client.join(`org:${orgId}`);
      this.logger.log(
        `Client connected: userId=${String(payload.sub)}, org=${orgId}`,
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
}
