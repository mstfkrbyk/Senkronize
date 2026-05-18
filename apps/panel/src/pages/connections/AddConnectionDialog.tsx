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
import {
  useCreateConnection,
  useTestConnection,
} from '@/hooks/useConnections';
import { getApiErrorMessage } from '@/lib/api';
import {
  FORM_MESSAGES,
  HTTPS_URL_CREDENTIAL_KEYS,
  isValidHttpOrHttpsUrl,
  isValidHttpsUrl,
} from '@/lib/form-messages';
import { cn } from '@/lib/utils';
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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

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
    setFieldErrors({});
  };

  const setField = (key: string, value: string): void => {
    setCredentials((prev) => ({ ...prev, [key]: value }));
    setLastTestOk(null);
    setFieldErrors((prev) => {
      if (!prev[key]) {
        return prev;
      }
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const validateCredentials = (): boolean => {
    const next: Record<string, string> = {};
    for (const f of selected.fields) {
      const raw = (credentials[f.key] ?? '').trim();
      if (f.required && raw.length === 0) {
        next[f.key] = FORM_MESSAGES.required;
        continue;
      }
      if (f.type === 'url' && raw.length > 0 && !isValidHttpOrHttpsUrl(raw)) {
        next[f.key] = 'Geçerli bir adres girin (http:// veya https://).';
        continue;
      }
      if (
        f.type !== 'url' &&
        HTTPS_URL_CREDENTIAL_KEYS.has(f.key) &&
        raw.length > 0 &&
        !isValidHttpsUrl(raw)
      ) {
        next[f.key] = FORM_MESSAGES.urlHttps;
      }
    }
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleTest = (): void => {
    if (!validateCredentials()) {
      return;
    }
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
    if (!validateCredentials()) {
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
          setFieldErrors({});
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
                aria-invalid={Boolean(fieldErrors[field.key])}
                className={cn(fieldErrors[field.key] && 'border-destructive')}
                value={credentials[field.key] ?? ''}
                onChange={(e) => {
                  setField(field.key, e.target.value);
                }}
              />
              {fieldErrors[field.key] ? (
                <p className="text-destructive text-sm">{fieldErrors[field.key]}</p>
              ) : null}
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
