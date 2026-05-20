import { OrderStatus } from '@prisma/client';

import { WebhookEvent } from './webhook-event.enum';

export function resolveOrderWebhookEvents(options: {
  isCreate: boolean;
  prevStatus?: OrderStatus;
  newStatus: OrderStatus;
}): WebhookEvent[] {
  if (options.isCreate) {
    return [WebhookEvent.ORDER_CREATED];
  }

  if (options.prevStatus === options.newStatus) {
    return [];
  }

  const events: WebhookEvent[] = [WebhookEvent.ORDER_UPDATED];

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
      events.push(WebhookEvent.ORDER_RETURNED);
      break;
    default:
      break;
  }

  return events;
}
