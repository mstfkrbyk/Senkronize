import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

import { WEBHOOK_EVENTS } from '../webhooks.constants';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: {
    name: string;
    url: string;
    events: string[];
    secret?: string;
  }) => void;
  isPending: boolean;
}

function generateSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function isHttpsUrl(value: string): boolean {
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function CreateWebhookModal({
  open,
  onOpenChange,
  onSubmit,
  isPending,
}: Props): ReactElement {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(
    () => new Set(['order.created']),
  );
  const [useManualSecret, setUseManualSecret] = useState(false);
  const [secret, setSecret] = useState('');

  const groupedEvents = useMemo(() => {
    const groups = new Map<string, (typeof WEBHOOK_EVENTS)[number][]>();
    for (const ev of WEBHOOK_EVENTS) {
      const list = groups.get(ev.group) ?? [];
      list.push(ev);
      groups.set(ev.group, list);
    }
    return [...groups.entries()];
  }, []);

  const toggleEvent = (id: string, checked: boolean): void => {
    setSelectedEvents((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      if (next.size === 0) {
        next.add(id);
      }
      return next;
    });
  };

  const resetForm = (): void => {
    setName('');
    setUrl('');
    setSelectedEvents(new Set(['order.created']));
    setUseManualSecret(false);
    setSecret('');
  };

  const handleSubmit = (): void => {
    const trimmedName = name.trim();
    const trimmedUrl = url.trim();
    if (!trimmedName || !trimmedUrl || !isHttpsUrl(trimmedUrl) || selectedEvents.size === 0) {
      return;
    }
    onSubmit({
      name: trimmedName,
      url: trimmedUrl,
      events: [...selectedEvents],
      secret: useManualSecret && secret.trim().length >= 16 ? secret.trim() : undefined,
    });
    resetForm();
  };

  const urlInvalid = url.trim().length > 0 && !isHttpsUrl(url.trim());

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          resetForm();
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('settings.webhooks.createTitle')}</DialogTitle>
          <DialogDescription>{t('settings.webhooks.createDescription')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="wh-create-name">{t('settings.webhooks.nameLabel')}</Label>
            <Input
              id="wh-create-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('settings.webhooks.namePlaceholder')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wh-create-url">{t('settings.webhooks.urlLabel')}</Label>
            <Input
              id="wh-create-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/hooks/senkronize"
            />
            {urlInvalid ? (
              <p className="text-xs text-destructive">{t('settings.webhooks.httpsRequired')}</p>
            ) : null}
          </div>
          <div className="space-y-3 rounded-md border border-border p-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="wh-manual-secret">{t('settings.webhooks.manualSecret')}</Label>
              <Switch
                id="wh-manual-secret"
                checked={useManualSecret}
                onCheckedChange={(checked) => {
                  setUseManualSecret(checked);
                  if (checked && secret.length < 16) {
                    setSecret(generateSecret());
                  }
                }}
              />
            </div>
            {useManualSecret ? (
              <div className="space-y-2">
                <Input
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  className="font-mono text-xs"
                  minLength={16}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSecret(generateSecret())}
                >
                  {t('settings.webhooks.regenerateSecret')}
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t('settings.webhooks.autoSecretHint')}
              </p>
            )}
          </div>
          <div className="space-y-3">
            <Label>{t('settings.webhooks.eventsLabel')}</Label>
            {groupedEvents.map(([group, events]) => (
              <div key={group} className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {group}
                </p>
                <div className="grid gap-2">
                  {events.map((ev) => (
                    <label
                      key={ev.id}
                      className="flex cursor-pointer items-center gap-2 rounded-md border border-border p-2"
                    >
                      <Checkbox
                        checked={selectedEvents.has(ev.id)}
                        onCheckedChange={(v) => toggleEvent(ev.id, v === true)}
                      />
                      <span className="text-sm">
                        {ev.label}{' '}
                        <span className="text-muted-foreground">({ev.id})</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            disabled={
              isPending ||
              !name.trim() ||
              !url.trim() ||
              urlInvalid ||
              selectedEvents.size === 0 ||
              (useManualSecret && secret.trim().length < 16)
            }
            onClick={handleSubmit}
          >
            {t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
