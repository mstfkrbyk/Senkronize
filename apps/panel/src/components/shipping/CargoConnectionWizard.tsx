import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';

import { useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { CargoProvider } from '@senkronize/shared';

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
import { getCargoDisplay } from '@/lib/cargo-display';
import { CARGO_PROVIDER_OPTIONS } from '@/lib/cargo-providers';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Zaten bağlı firmalar — sihirbazda gizlenir */
  connectedProviders?: string[];
}

export function CargoConnectionWizard({
  open,
  onOpenChange,
  connectedProviders = [],
}: Props): ReactElement {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<1 | 2>(1);
  const [provider, setProvider] = useState<CargoProvider>('YURTICI');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [saving, setSaving] = useState(false);

  const availableProviders = CARGO_PROVIDER_OPTIONS.filter(
    (o) =>
      !connectedProviders.some(
        (p) => p.trim().toUpperCase().replace(/[\s-]+/g, '_') === o.value,
      ),
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    setStep(1);
    setApiKey('');
    setApiSecret('');
    const first = availableProviders[0]?.value ?? 'YURTICI';
    setProvider(first);
  }, [open, availableProviders]);

  const display = getCargoDisplay(provider);

  const handleSave = async (): Promise<void> => {
    if (apiKey.trim().length === 0) {
      toast.error('API anahtarı zorunludur');
      return;
    }
    setSaving(true);
    try {
      // Kargo bağlantı CRUD API panelde henüz yok; kullanıcıyı entegrasyonlara yönlendir.
      await new Promise((resolve) => {
        setTimeout(resolve, 400);
      });
      void queryClient.invalidateQueries({ queryKey: ['connections', 'unified'] });
      toast.success(`${display.label} bağlantı bilgileri alındı`, {
        description:
          'Kayıt tamamlanması için Entegrasyonlar sayfasındaki kargo sekmesini kullanın veya destek ekibiyle iletişime geçin.',
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Kargo bağla</DialogTitle>
          <DialogDescription>
            {step === 1
              ? 'Bağlamak istediğiniz kargo firmasını seçin.'
              : `${display.logo} ${display.label} API bilgilerinizi girin.`}
          </DialogDescription>
        </DialogHeader>

        {availableProviders.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Tanımlı tüm kargo firmaları zaten bağlı. Yeni firma için destek ile iletişime geçin.
          </p>
        ) : null}

        {step === 1 && availableProviders.length > 0 ? (
          <div className="grid gap-2 py-2">
            <Label htmlFor="cargo-wizard-provider">Kargo firması</Label>
            <Select
              value={provider}
              onValueChange={(v) => {
                setProvider(v as CargoProvider);
              }}
            >
              <SelectTrigger id="cargo-wizard-provider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableProviders.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    <span className="mr-2" aria-hidden>
                      {getCargoDisplay(o.value).logo}
                    </span>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="grid gap-3 py-2">
            <div className="grid gap-2">
              <Label htmlFor="cargo-wizard-api-key">API anahtarı</Label>
              <Input
                id="cargo-wizard-api-key"
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                }}
                autoComplete="off"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cargo-wizard-api-secret">API secret (varsa)</Label>
              <Input
                id="cargo-wizard-api-secret"
                type="password"
                value={apiSecret}
                onChange={(e) => {
                  setApiSecret(e.target.value);
                }}
                autoComplete="off"
              />
            </div>
          </div>
        ) : null}

        <DialogFooter className="gap-2 sm:gap-0">
          {step === 2 ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setStep(1);
              }}
            >
              Geri
            </Button>
          ) : (
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              İptal
            </Button>
          )}
          {step === 1 && availableProviders.length > 0 ? (
            <Button
              type="button"
              onClick={() => {
                setStep(2);
              }}
            >
              Devam
            </Button>
          ) : null}
          {step === 2 ? (
            <Button type="button" disabled={saving} onClick={() => void handleSave()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              Bağlantıyı kaydet
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
