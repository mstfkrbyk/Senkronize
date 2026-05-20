import type { ReactElement } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { WidgetType } from '@/types/dashboard-widgets';

import { WIDGET_LABELS } from './widget-meta';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableTypes: WidgetType[];
  onAdd: (type: WidgetType) => void;
}

export function DashboardAddWidgetDialog({
  open,
  onOpenChange,
  availableTypes,
  onAdd,
}: Props): ReactElement {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Widget ekle</DialogTitle>
          <DialogDescription>
            Dashboard&apos;a eklemek istediğiniz widget&apos;ı seçin.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-72 space-y-2 overflow-y-auto py-2">
          {availableTypes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Eklenebilecek widget kalmadı.</p>
          ) : (
            availableTypes.map((type) => (
              <Button
                key={type}
                type="button"
                variant="outline"
                className="w-full justify-start"
                onClick={() => {
                  onAdd(type);
                  onOpenChange(false);
                }}
              >
                {WIDGET_LABELS[type]}
              </Button>
            ))
          )}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            Kapat
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
