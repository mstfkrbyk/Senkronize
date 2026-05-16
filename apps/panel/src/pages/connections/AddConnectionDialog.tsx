import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getApiErrorMessage } from '@/lib/api';
import {
  useCreateConnection,
  useTestConnection,
} from '@/hooks/useConnections';
import { MARKETPLACE_OPTIONS } from '@/pages/onboarding/onboarding.options';
import type { MarketplaceOption } from '@/pages/onboarding/onboarding.types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function emptyCredentials(option: MarketplaceOption): Record<string, string> {
  return Object.fromEntries(option.fields.map((f) => [f.key, '']));
}

export function AddConnectionDialog({
  open,
  onOpenChange,
}: Props): ReactElement {
  const [platform, setPlatform] = useState<string>(MARKETPLACE_OPTIONS[0].id);
  const [credentials, setCredentials] = useState<Record<string, string>>(() =>
    emptyCredentials(MARKETPLACE_OPTIONS[0]),
  );
  const [lastTestOk, setLastTestOk] = useState<boolean | null>(null);

  const selected = useMemo(
    () => MARKETPLACE_OPTIONS.find((o) => o.id === platform) ?? MARKETPLACE_OPTIONS[0],
    [platform],
  );

  const testMutation = useTestConnection();
  const createMutation = useCreateConnection();

  const handlePlatformChange = (value: string): void => {
    setPlatform(value);
    const opt = MARKETPLACE_OPTIONS.find((o) => o.id === value);
    if (opt) {
      setCredentials(emptyCredentials(opt));
    }
    setLastTestOk(null);
  };

  const setField = (key: string, value: string): void => {
    setCredentials((prev) => ({ ...prev, [key]: value }));
    setLastTestOk(null);
  };

  const requiredFilled = selected.fields.every((f) => {
    if (!f.required) {
      return true;
    }
    return (credentials[f.key] ?? '').trim().length > 0;
  });

  const handleTest = (): void => {
    testMutation.mutate(
      { platform, credentials },
      {
        onSuccess: (res) => {
          setLastTestOk(res.connected);
          if (res.connected) {
            toast.success('Bağlantı testi başarılı.');
          } else {
            toast.warning(
              'Test başarısız görünüyor; yine de kaydedebilirsiniz.',
            );
          }
        },
        onError: (error) => {
          setLastTestOk(false);
          toast.error(getApiErrorMessage(error));
        },
      },
    );
  };

  const handleSave = (): void => {
    if (!requiredFilled) {
      toast.error('Lütfen tüm zorunlu alanları doldurun.');
      return;
    }
    createMutation.mutate(
      { platform, credentials },
      {
        onSuccess: () => {
          toast.success('Entegrasyon kaydedildi.');
          onOpenChange(false);
          setLastTestOk(null);
        },
        onError: (error) => {
          toast.error(getApiErrorMessage(error));
        },
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          setLastTestOk(null);
        }
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Yeni pazaryeri bağlantısı</DialogTitle>
          <DialogDescription>
            Kimlik bilgileriniz şifrelenerek saklanır; ekranda tekrar
            gösterilmez.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="platform">Platform</Label>
            <Select value={platform} onValueChange={handlePlatformChange}>
              <SelectTrigger id="platform">
                <SelectValue placeholder="Platform seçin" />
              </SelectTrigger>
              <SelectContent>
                {MARKETPLACE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.id} value={opt.id}>
                    {opt.logo} {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selected.fields.map((field) => (
            <div key={field.key} className="grid gap-2">
              <Label htmlFor={field.key}>
                {field.label}
                {field.required ? ' *' : ''}
              </Label>
              <Input
                id={field.key}
                type={field.type === 'password' ? 'password' : 'text'}
                autoComplete="off"
                placeholder={field.placeholder}
                value={credentials[field.key] ?? ''}
                onChange={(e) => {
                  setField(field.key, e.target.value);
                }}
              />
            </div>
          ))}
          {lastTestOk === false ? (
            <p className="text-sm text-amber-600">
              Test başarısız oldu; kayıt yine de mümkündür.
            </p>
          ) : null}
        </div>
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
            variant="secondary"
            disabled={testMutation.isPending}
            onClick={() => {
              handleTest();
            }}
          >
            {testMutation.isPending ? 'Test ediliyor…' : 'Test Et'}
          </Button>
          <Button
            type="button"
            disabled={createMutation.isPending}
            onClick={() => {
              handleSave();
            }}
          >
            {createMutation.isPending ? 'Kaydediliyor…' : 'Kaydet'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
