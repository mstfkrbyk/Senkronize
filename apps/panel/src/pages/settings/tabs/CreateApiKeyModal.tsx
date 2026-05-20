import type { ReactElement } from 'react';
import { useState } from 'react';
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

import {
  API_KEY_PERMISSIONS,
  type ApiKeyPermission,
  sanitizePermissionsForApi,
} from '../api-keys.constants';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: {
    name: string;
    permissions: ApiKeyPermission[];
    expiresAt?: string;
  }) => void;
  isPending: boolean;
}

export function CreateApiKeyModal({
  open,
  onOpenChange,
  onSubmit,
  isPending,
}: Props): ReactElement {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<Set<ApiKeyPermission>>(
    () => new Set(['orders:read', 'products:read']),
  );
  const [expiresAt, setExpiresAt] = useState('');

  const togglePermission = (perm: ApiKeyPermission, checked: boolean): void => {
    setSelectedPermissions((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(perm);
      } else {
        next.delete(perm);
      }
      return next;
    });
  };

  const handleSubmit = (): void => {
    const trimmed = name.trim();
    if (!trimmed || selectedPermissions.size === 0) {
      return;
    }
    const accepted = sanitizePermissionsForApi([...selectedPermissions]);
    onSubmit({
      name: trimmed,
      permissions: accepted.length > 0 ? (accepted as ApiKeyPermission[]) : ['orders:read'],
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
    });
    setName('');
    setExpiresAt('');
    setSelectedPermissions(new Set(['orders:read', 'products:read']));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('settings.apiKeys.createTitle')}</DialogTitle>
          <DialogDescription>{t('settings.apiKeys.createDescription')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="api-key-name">{t('settings.apiKeys.nameLabel')}</Label>
            <Input
              id="api-key-name"
              placeholder={t('settings.apiKeys.namePlaceholder')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('settings.apiKeys.permissionsLabel')}</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {API_KEY_PERMISSIONS.map((perm) => {
                const isReports = perm.value === 'reports:read';
                return (
                  <label
                    key={perm.value}
                    className="flex cursor-pointer items-center gap-2 rounded-md border border-border p-2 text-sm"
                  >
                    <Checkbox
                      checked={selectedPermissions.has(perm.value)}
                      disabled={isReports}
                      onCheckedChange={(checked) =>
                        togglePermission(perm.value, checked === true)
                      }
                    />
                    <span className={isReports ? 'text-muted-foreground' : undefined}>
                      {t(perm.labelKey)}
                      {isReports ? ` (${t('settings.apiKeys.comingSoon')})` : null}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="api-key-expires">{t('settings.apiKeys.expiresLabel')}</Label>
            <Input
              id="api-key-expires"
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isPending || !name.trim() || selectedPermissions.size === 0}
          >
            {t('settings.apiKeys.createButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
