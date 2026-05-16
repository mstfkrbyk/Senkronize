import type { ReactElement } from 'react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { mockTestMarketplaceConnection } from '@/pages/onboarding/onboarding.api';
import { MARKETPLACE_OPTIONS } from '@/pages/onboarding/onboarding.options';
import type { CredentialField } from '@/pages/onboarding/onboarding.types';

interface Props {
  selectedMarketplace: string | null;
  credentials: Record<string, string>;
  onSelectMarketplace: (id: string) => void;
  onCredentialChange: (key: string, value: string) => void;
  onTestSuccess: () => void;
  testPassed: boolean;
  onResetTest: () => void;
}

export function Step2Marketplace({
  selectedMarketplace,
  credentials,
  onSelectMarketplace,
  onCredentialChange,
  onTestSuccess,
  testPassed,
  onResetTest,
}: Props): ReactElement {
  const [testing, setTesting] = useState(false);
  const option = MARKETPLACE_OPTIONS.find((o) => o.id === selectedMarketplace);

  const requiredFilled =
    option?.fields.every((f) => {
      if (!f.required) {
        return true;
      }
      return Boolean(credentials[f.key]?.trim());
    }) ?? false;

  async function handleTest(): Promise<void> {
    if (!option || !requiredFilled) {
      return;
    }
    setTesting(true);
    try {
      await mockTestMarketplaceConnection();
      onTestSuccess();
    } finally {
      setTesting(false);
    }
  }

  return (
    <Card className="border-0 shadow-none md:border md:shadow-sm">
      <CardHeader className="space-y-1 px-0 md:px-6">
        <CardTitle className="text-xl md:text-2xl">
          Hangi pazaryerinde satış yapıyorsunuz?
        </CardTitle>
        <CardDescription>
          Bir pazaryeri seçin ve API bilgilerinizi girin. Test başarılı olduktan sonra devam
          edebilirsiniz.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 px-0 md:px-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {MARKETPLACE_OPTIONS.map((m) => {
            const active = selectedMarketplace === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  onSelectMarketplace(m.id);
                  onResetTest();
                }}
                className={cn(
                  'flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-colors',
                  'hover:border-accent/60 hover:bg-muted/40',
                  active && 'border-accent ring-2 ring-accent/30',
                )}
              >
                <span className="text-2xl" aria-hidden>
                  {m.logo}
                </span>
                <span className="font-medium">{m.label}</span>
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
                  <Label htmlFor={`mp-${field.key}`}>{field.label}</Label>
                  <Input
                    id={`mp-${field.key}`}
                    type={field.type === 'password' ? 'password' : 'text'}
                    autoComplete="off"
                    placeholder={field.placeholder}
                    value={credentials[field.key] ?? ''}
                    onChange={(e) => {
                      onCredentialChange(field.key, e.target.value);
                      onResetTest();
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Button
                type="button"
                variant="secondary"
                disabled={!requiredFilled || testing}
                onClick={() => void handleTest()}
              >
                {testing ? 'Test ediliyor…' : 'Bağlantıyı Test Et'}
              </Button>
              {testPassed ? (
                <Badge className="w-fit bg-emerald-600 text-primary-foreground hover:bg-emerald-600">
                  Test başarılı
                </Badge>
              ) : null}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
