import type { ReactElement } from 'react';
import { useEffect } from 'react';

import { NotificationCenter } from '@/components/NotificationCenter';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSocket } from '@/hooks/useSocket';
import { useUiStore, type Notification, type NotificationType } from '@/store/ui.store';
import { Bell } from 'lucide-react';

const VALID_TYPES: readonly NotificationType[] = [
  'sync_error',
  'sync_success',
  'low_stock',
  'order_new',
  'buybox_won',
  'trial_expiring',
  'order',
  'stock',
  'system',
  'payment',
] as const;

function isNotificationType(value: unknown): value is NotificationType {
  return typeof value === 'string' && VALID_TYPES.includes(value as NotificationType);
}

function parseSocketNotification(
  data: unknown,
): Omit<Notification, 'id' | 'read' | 'createdAt'> | null {
  if (data === null || typeof data !== 'object') {
    return null;
  }
  const o = data as Record<string, unknown>;
  const title = o.title;
  const message = o.message;
  if (typeof title !== 'string' || typeof message !== 'string') {
    return null;
  }
  const typeRaw = o.type;
  const type: NotificationType = isNotificationType(typeRaw) ? typeRaw : 'system';
  return { type, title, message };
}

export function NotificationBell(): ReactElement {
  const notifications = useUiStore((s) => s.notifications);
  const addNotification = useUiStore((s) => s.addNotification);
  const { on } = useSocket();

  useEffect(() => {
    return on('notification:new', (payload) => {
      const parsed = parseSocketNotification(payload);
      if (parsed) {
        addNotification(parsed);
      }
    });
  }, [on, addNotification]);

  const unread = notifications.filter((n) => !n.read).length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative shrink-0"
          aria-label="Bildirimler"
        >
          <Bell className="size-5" />
          {unread > 0 ? (
            <Badge
              variant="destructive"
              className="absolute -right-0.5 -top-0.5 flex size-5 items-center justify-center rounded-full p-0 text-[10px]"
            >
              {unread > 9 ? '9+' : unread}
            </Badge>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="overflow-hidden p-0" sideOffset={8}>
        <NotificationCenter />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
