import type { ReactElement } from 'react';

import { useUiStore } from '@/store/ui.store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell } from 'lucide-react';

export function NotificationBell(): ReactElement {
  const count = useUiStore((s) => s.unreadNotifications);

  return (
    <Button type="button" variant="ghost" size="icon" className="relative shrink-0">
      <Bell className="size-5" />
      <span className="sr-only">Bildirimler</span>
      {count > 0 ? (
        <Badge
          variant="destructive"
          className="absolute -right-0.5 -top-0.5 flex size-5 items-center justify-center rounded-full p-0 text-[10px]"
        >
          {count > 9 ? '9+' : count}
        </Badge>
      ) : null}
    </Button>
  );
}
