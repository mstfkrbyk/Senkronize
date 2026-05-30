import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';
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
  apiKeyPermissionLabel,
  type ApiKeyPermission,
  type ApiKeyRow,
  readStoredApiKeyPermissions,
  sanitizePermissionsForApi,
} from '../api-keys.constants';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  apiKey: ApiKeyRow | null;
  onSubmit: (input: {
    id: string;
    name: string;
    permissions: ApiKeyPermission[];
    expiresAt?: string;
  }) => void;
  isPending: boolean;
}

export function EditApiKeyModal({
  open,
  onOpenChange,
  apiKey,
  onSubmit,
  isPending,
}: Props): ReactElement {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<Set<ApiKeyPermission>>(
    () => new Set(),
  );
  const [expiresAt, setExpiresAt] = useState('');

  useEffect(() => {
    if (!apiKey) {
      return;
    }
    setName(apiKey.name);
    const stored = readStoredApiKeyPermissions(apiKey.id) ?? apiKey.permissions ?? [];
    setSelectedPermissions(new Set(stored as ApiKeyPermission[]));
    setExpiresAt(
      apiKey.expiresAt ? new Date(apiKey.expiresAt).toISOString().slice(0, 10) : '',
    );
  }, [apiKey]);

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
    if (!apiKey) {
      return;
    }
    const trimmed = name.trim();
    if (!trimmed || selectedPermissions.size === 0) {
      return;
    }
    const accepted = sanitizePermissionsForApi([...selectedPermissions]);
    onSubmit({
      id: apiKey.id,
      name: trimmed,
      permissions: accepted.length > 0 ? (accepted as ApiKeyPermission[]) : ['orders:read'],
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('settings.apiKeys.editTitle')}</DialogTitle>
          <DialogDescription>{t('settings.apiKeys.editDescription')}</DialogDescription>
        </DialogHeader>
        {apiKey ? (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-api-key-name">{t('settings.apiKeys.nameLabel')}</Label>
              <Input
                id="edit-api-key-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
              />
            </div>
            <div className="rounded-md border border-border bg-muted/30 px-3 py-2 font-mono text-xs text-muted-foreground">
              {apiKey.keyPrefix}…
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
                        {apiKeyPermissionLabel(perm.value, t)}
                        {isReports ? ` (${t('settings.apiKeys.comingSoon')})` : null}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-api-key-expires">{t('settings.apiKeys.expiresLabel')}</Label>
              <Input
                id="edit-api-key-expires"
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </div>
          </div>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isPending || !name.trim() || selectedPermissions.size === 0}
          >
            {t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
