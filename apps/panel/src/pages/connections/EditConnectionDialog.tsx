import type { ReactElement } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
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
import { getApiErrorMessage } from '@/lib/api';
import { useUpdateMarketplaceConnection } from '@/hooks/useConnections';
import { MARKETPLACE_OPTIONS } from '@/pages/onboarding/onboarding.options';
import type { MarketplaceConnectionDto } from '@/types/connection';

interface Props {
  connection: MarketplaceConnectionDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditConnectionDialog({
  connection,
  open,
  onOpenChange,
}: Props): ReactElement {
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const updateMutation = useUpdateMarketplaceConnection();

  const option = useMemo(
    () => MARKETPLACE_OPTIONS.find((o) => o.id === connection.platform),
    [connection.platform],
  );

  useEffect(() => {
    if (open && connection) {
      setCredentials(
        Object.fromEntries(
          (MARKETPLACE_OPTIONS.find((o) => o.id === connection.platform)?.fields ??
            []
          ).map((f) => [f.key, '']),
        ),
      );
    }
  }, [open, connection]);

  const handleSave = (): void => {
    const patch: Record<string, string> = {};
    for (const [k, v] of Object.entries(credentials)) {
      if (v.trim().length > 0) {
        patch[k] = v.trim();
      }
    }
    if (Object.keys(patch).length === 0) {
      toast.error('Güncellemek için en az bir alan girin.');
      return;
    }
    updateMutation.mutate(
      { id: connection.id, credentials: patch },
      {
        onSuccess: () => {
          toast.success('Bağlantı güncellendi.');
          onOpenChange(false);
        },
        onError: (error) => {
          toast.error(getApiErrorMessage(error));
        },
      },
    );
  };

  const branding = option
    ? `${option.logo} ${option.label}`
    : connection.platform;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Bağlantıyı düzenle</DialogTitle>
          <DialogDescription>
            {branding} — Güvenlik nedeniyle mevcut gizli alanlar gösterilmez;
            değiştirmek istediklerinizi yeniden girin.
          </DialogDescription>
        </DialogHeader>
        {option ? (
          <div className="grid gap-4 py-2">
            {option.fields.map((field) => (
              <div key={field.key} className="grid gap-2">
                <Label htmlFor={`edit-${field.key}`}>
                  {field.label}
                  {field.required ? ' *' : ''}
                </Label>
                <Input
                  id={`edit-${field.key}`}
                  type={field.type === 'password' ? 'password' : 'text'}
                  autoComplete="off"
                  placeholder="Yeni değer"
                  value={credentials[field.key] ?? ''}
                  onChange={(e) => {
                    setCredentials((prev) => ({
                      ...prev,
                      [field.key]: e.target.value,
                    }));
                  }}
                />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Bu platform için düzenleme formu tanımlı değil.
          </p>
        )}
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            İptal
          </Button>
          <Button
            type="button"
            disabled={!option || updateMutation.isPending}
            onClick={() => {
              handleSave();
            }}
          >
            {updateMutation.isPending ? 'Kaydediliyor…' : 'Kaydet'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
