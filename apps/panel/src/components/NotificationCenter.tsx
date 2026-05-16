import type { ReactElement } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import { CreditCard, Package, Settings, ShoppingCart } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useUiStore, type Notification, type NotificationType } from '@/store/ui.store';
import { cn } from '@/lib/utils';

function typeIcon(type: NotificationType): ReactElement {
  const common = 'size-4 shrink-0';
  switch (type) {
    case 'order':
      return <ShoppingCart className={cn(common, 'text-sky-500')} aria-hidden />;
    case 'stock':
      return <Package className={cn(common, 'text-amber-500')} aria-hidden />;
    case 'payment':
      return <CreditCard className={cn(common, 'text-emerald-600')} aria-hidden />;
    default:
      return <Settings className={cn(common, 'text-slate-500')} aria-hidden />;
  }
}

export function NotificationCenter(): ReactElement {
  const notifications = useUiStore((s) => s.notifications);
  const markAllRead = useUiStore((s) => s.markAllRead);
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <div className="flex max-h-[min(24rem,70vh)] w-96 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2">
        <p className="text-sm font-semibold text-foreground">Bildirimler</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 text-xs"
          disabled={unread === 0}
          onClick={() => markAllRead()}
        >
          Tümünü okundu işaretle
        </Button>
      </div>
      <ScrollArea className="h-80">
        {notifications.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">
            Henüz bildirim yok.
          </p>
        ) : (
          <ul className="divide-y p-0">
            {notifications.map((n) => (
              <NotificationRow key={n.id} notification={n} />
            ))}
          </ul>
        )}
      </ScrollArea>
    </div>
  );
}

interface RowProps {
  notification: Notification;
}

function NotificationRow({ notification: n }: RowProps): ReactElement {
  return (
    <li className="flex gap-3 px-3 py-3 text-left">
      <div className="relative pt-0.5">
        {typeIcon(n.type)}
        {!n.read ? (
          <span
            className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-amber-400"
            title="Okunmadı"
          />
        ) : null}
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm font-medium leading-tight text-foreground">{n.title}</p>
        <p className="text-xs text-muted-foreground">{n.message}</p>
        <p className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: tr })}
        </p>
      </div>
    </li>
  );
}
