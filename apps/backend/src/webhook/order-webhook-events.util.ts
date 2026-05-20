import { OrderStatus } from '@prisma/client';

import { WebhookEvent, type WebhookEventId } from './webhook-event.enum';

export function resolveOrderWebhookEvents(options: {
  isCreate: boolean;
  prevStatus?: OrderStatus;
  newStatus: OrderStatus;
}): WebhookEventId[] {
  if (options.isCreate) {
    return [WebhookEvent.ORDER_CREATED];
  }

  if (options.prevStatus === options.newStatus) {
    return [];
  }

  const events: WebhookEventId[] = [WebhookEvent.ORDER_STATUS_CHANGED];

  switch (options.newStatus) {
    case OrderStatus.SHIPPED:
      events.push(WebhookEvent.ORDER_SHIPPED);
      break;
    case OrderStatus.DELIVERED:
      events.push(WebhookEvent.ORDER_DELIVERED);
      break;
    case OrderStatus.CANCELLED:
      events.push(WebhookEvent.ORDER_CANCELLED);
      break;
    case OrderStatus.RETURNED:
      break;
    default:
      break;
  }

  return events;
}
