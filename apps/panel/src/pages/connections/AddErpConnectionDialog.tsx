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
  useCreateErpConnection,
  useTestErpConnection,
} from '@/hooks/useErpConnections';
import { getApiErrorMessage } from '@/lib/api';
import { ERP_OPTIONS, type ErpOption } from '@/pages/connections/erp-display';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function emptyCredentials(option: ErpOption): Record<string, string> {
  return Object.fromEntries(option.fields.map((f) => [f.key, '']));
}

export function AddErpConnectionDialog({
  open,
  onOpenChange,
}: Props): ReactElement {
  const [erpType, setErpType] = useState<string>(ERP_OPTIONS[0].id);
  const [credentials, setCredentials] = useState<Record<string, string>>(() =>
    emptyCredentials(ERP_OPTIONS[0]),
  );
  const [lastTestOk, setLastTestOk] = useState<boolean | null>(null);

  const selected = useMemo(
    () => ERP_OPTIONS.find((o) => o.id === erpType) ?? ERP_OPTIONS[0],
    [erpType],
  );

  const testMutation = useTestErpConnection();
  const createMutation = useCreateErpConnection();

  const handleErpChange = (value: string): void => {
    setErpType(value);
    const opt = ERP_OPTIONS.find((o) => o.id === value);
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
      { erpType, credentials },
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
      { erpType, credentials },
      {
        onSuccess: () => {
          toast.success('ERP bağlantısı kaydedildi.');
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
          <DialogTitle>Yeni ERP bağlantısı</DialogTitle>
          <DialogDescription>
            Kimlik bilgileriniz şifrelenerek saklanır; ekranda tekrar
            gösterilmez.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="erp-type">ERP</Label>
            <Select value={erpType} onValueChange={handleErpChange}>
              <SelectTrigger id="erp-type">
                <SelectValue placeholder="ERP seçin" />
              </SelectTrigger>
              <SelectContent>
                {ERP_OPTIONS.map((opt) => (
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
