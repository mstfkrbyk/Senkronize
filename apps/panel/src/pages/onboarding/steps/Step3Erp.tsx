import type { ReactElement } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { ERP_OPTIONS } from '@/pages/onboarding/onboarding.options';
import type { CredentialField } from '@/pages/onboarding/onboarding.types';

interface Props {
  selectedErp: string | null;
  credentials: Record<string, string>;
  onSelectErp: (id: string | null) => void;
  onCredentialChange: (key: string, value: string) => void;
  onSkip: () => void;
}

export function Step3Erp({
  selectedErp,
  credentials,
  onSelectErp,
  onCredentialChange,
  onSkip,
}: Props): ReactElement {
  const option = ERP_OPTIONS.find((o) => o.id === selectedErp);

  const erpFieldsValid =
    !option ||
    option.fields.every((f) => {
      if (!f.required) {
        return true;
      }
      return Boolean(credentials[f.key]?.trim());
    });

  return (
    <Card className="border-0 shadow-none md:border md:shadow-sm">
      <div className="flex flex-col gap-2 border-b px-0 pb-4 md:flex-row md:items-start md:justify-between md:px-6 md:pt-6">
        <CardHeader className="space-y-1 p-0">
          <CardTitle className="text-xl md:text-2xl">
            ERP veya e-ticaret altyapınız var mı?
          </CardTitle>
          <CardDescription>
            İsterseniz şimdi bağlayın; yoksa atlayıp daha sonra Ayarlar üzerinden ekleyebilirsiniz.
          </CardDescription>
        </CardHeader>
        <Button
          type="button"
          variant="link"
          className="h-auto shrink-0 self-end px-0 text-muted-foreground md:self-start"
          onClick={onSkip}
        >
          Şimdilik Atla
        </Button>
      </div>
      <CardContent className="space-y-6 px-0 pt-6 md:px-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {ERP_OPTIONS.map((e) => {
            const active = selectedErp === e.id;
            return (
              <button
                key={e.id}
                type="button"
                onClick={() => onSelectErp(e.id)}
                className={cn(
                  'flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-colors',
                  'hover:border-accent/60 hover:bg-muted/40',
                  active && 'border-accent ring-2 ring-accent/30',
                )}
              >
                <span className="text-2xl" aria-hidden>
                  {e.logo}
                </span>
                <span className="font-medium">{e.label}</span>
              </button>
            );
          })}
        </div>

        {option ? (
          <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
            <p className="text-sm font-medium">{option.label} bağlantı bilgileri</p>
            <div className="grid gap-4">
              {option.fields.map((field: CredentialField) => (
                <div key={field.key} className="space-y-2">
                  <Label htmlFor={`erp-${field.key}`}>{field.label}</Label>
                  <Input
                    id={`erp-${field.key}`}
                    type={field.type === 'password' ? 'password' : 'text'}
                    autoComplete="off"
                    placeholder={field.placeholder}
                    value={credentials[field.key] ?? ''}
                    onChange={(e) => onCredentialChange(field.key, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {!option || erpFieldsValid ? null : (
          <p className="text-sm text-destructive">
            Seçtiğiniz altyapı için zorunlu alanları doldurun veya atlayın.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
