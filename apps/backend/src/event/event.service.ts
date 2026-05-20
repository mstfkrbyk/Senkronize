import { Injectable } from '@nestjs/common';

import { NotificationEmitService } from '../notifications/notification-emit.service';

import { WS_EVENTS, type WsEventName } from './event.types';

@Injectable()
export class EventService {
  constructor(private readonly notificationEmit: NotificationEmitService) {}

  emit(organizationId: string, event: WsEventName, data: unknown): void {
    this.notificationEmit.emitLegacy(organizationId, event, data);
  }
}
