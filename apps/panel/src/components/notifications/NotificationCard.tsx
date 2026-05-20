import type { ReactElement } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Check, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { InAppNotification } from '@/store/notifications.store';

import {
  CategoryIcon,
  categoryLabel,
  categoryStyles,
  visualCategoryForType,
} from './notification-utils';

interface Props {
  notification: InAppNotification;
  onActivate: (notification: InAppNotification) => void;
  onDelete?: (id: string) => void;
  onMarkRead?: (id: string) => void;
  deletePending?: boolean;
  markReadPending?: boolean;
  compact?: boolean;
}

export function NotificationCard({
  notification,
  onActivate,
  onDelete,
  onMarkRead,
  deletePending = false,
  markReadPending = false,
  compact = false,
}: Props): ReactElement {
  const category = visualCategoryForType(notification.type);
  const styles = categoryStyles(category);

  return (
    <li
      className={cn(
        'group relative',
        !notification.isRead && 'border-l-4',
        !notification.isRead && styles.unreadBorder,
      )}
    >
      <div className="flex gap-2">
        <button
          type="button"
          className={cn(
            'flex min-w-0 flex-1 gap-3 text-left transition-colors hover:bg-muted/60',
            compact ? 'px-3 py-2.5' : 'px-3 py-3',
          )}
          onClick={() => onActivate(notification)}
        >
          <span
            className={cn(
              'mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full',
              styles.iconBg,
              styles.iconText,
            )}
          >
            <CategoryIcon category={category} />
          </span>
          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="flex items-start gap-2">
              <p
                className={cn(
                  'flex-1 text-sm leading-tight text-foreground',
                  !notification.isRead && 'font-semibold',
                )}
              >
                {notification.title}
              </p>
              {notification.isRead ? (
                <Check
                  className="size-3.5 shrink-0 text-muted-foreground"
                  aria-label="Okundu"
                />
              ) : (
                <span
                  className="size-2 shrink-0 rounded-full bg-sky-500"
                  aria-label="Okunmadı"
                />
              )}
            </div>
            <p className="line-clamp-2 text-xs text-muted-foreground">
              {notification.message}
            </p>
            <p className="text-[11px] text-muted-foreground">
              <span className="font-medium">{categoryLabel(category)}</span>
              {' · '}
              {formatDistanceToNow(new Date(notification.createdAt), {
                addSuffix: true,
                locale: tr,
              })}
            </p>
          </div>
        </button>
        <div className="flex shrink-0 flex-col gap-0.5 pr-1 pt-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
          {!notification.isRead && onMarkRead ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7"
              aria-label="Okundu işaretle"
              disabled={markReadPending}
              onClick={() => onMarkRead(notification.id)}
            >
              <Check className="size-3.5" />
            </Button>
          ) : null}
          {onDelete ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground hover:text-destructive"
              aria-label="Bildirimi sil"
              disabled={deletePending}
              onClick={() => onDelete(notification.id)}
            >
              <Trash2 className="size-3.5" />
            </Button>
          ) : null}
        </div>
      </div>
    </li>
  );
}
