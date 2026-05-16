import { Injectable } from '@nestjs/common';
import { EventGateway } from './event.gateway';
import type { WsEventName } from './event.types';

@Injectable()
export class EventService {
  constructor(private readonly gateway: EventGateway) {}

  emit(organizationId: string, event: WsEventName, data: unknown): void {
    this.gateway.server.to(`org:${organizationId}`).emit(event, data);
  }
}
