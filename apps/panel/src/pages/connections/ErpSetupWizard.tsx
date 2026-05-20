import confetti from 'canvas-confetti';
import type { ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  useCreateErpConnection,
  useTestErpConnection,
} from '@/hooks/useErpConnections';
import { useAuth } from '@/hooks/useAuth';
import { getApiErrorMessage } from '@/lib/api';
import {
  ERP_CONNECTION_FORM_FIELDS,
  ERP_TYPE_IDS,
  ERP_WIZARD_FEATURED_IDS,
  getErpFormFields,
  getErpPlatformMeta,
  type ConnectionFormFieldDef,
} from '@/lib/connection-form-fields';
import { FORM_MESSAGES, isValidHttpOrHttpsUrl } from '@/lib/form-messages';
import { getErpDisplay } from '@/lib/platform-display';
import { cn } from '@/lib/utils';

const STEP_COUNT = 4;
const STEP_LABELS = ['ERP Seç', 'Kimlik Bilgileri', 'Eşitleme', 'Tamamlandı'] as const;

type SyncFrequency = 'realtime' | '15m' | '1h' | 'manual';

interface SyncPreferences {
  frequency: SyncFrequency;
  syncStock: boolean;
  syncProduct: boolean;
  syncInvoice: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleted?: () => void;
}

function emptyValuesFromFields(fields: ConnectionFormFieldDef[]): Record<string, string> {
  return Object.fromEntries(
    fields.map((f) => [f.key, f.defaultValue !== undefined ? String(f.defaultValue) : '']),
  );
}

function validateFields(
  fields: ConnectionFormFieldDef[],
  values: Record<string, string>,
): Record<string, string> {
  const next: Record<string, string> = {};
  for (const f of fields) {
    const raw = (values[f.key] ?? '').trim();
    if (f.required && raw.length === 0) {
      next[f.key] = FORM_MESSAGES.required;
      continue;
    }
    if (f.type === 'url' && raw.length > 0 && !isValidHttpOrHttpsUrl(raw)) {
      next[f.key] = 'Geçerli bir adres girin (http:// veya https://).';
      continue;
    }
    if (f.type === 'number' && raw.length > 0 && Number.isNaN(Number(raw))) {
      next[f.key] = 'Geçerli bir sayı girin.';
    }
  }
  return next;
}

function saveSyncPreferences(orgId: string, erpType: string, prefs: SyncPreferences): void {
  try {
    localStorage.setItem(
      `senkronize:erp-sync-prefs:${orgId}:${erpType}`,
      JSON.stringify(prefs),
    );
  } catch {
    // localStorage kullanılamıyorsa sessizce geç
  }
}

const FREQUENCY_OPTIONS: { value: SyncFrequency; label: string }[] = [
  { value: 'realtime', label: 'Anlık' },
  { value: '15m', label: '15 dakika' },
  { value: '1h', label: '1 saat' },
  { value: 'manual', label: 'Manuel' },
];

export function ErpSetupWizard({ open, onOpenChange, onCompleted }: Props): ReactElement {
  const { data: me } = useAuth();
  const orgId = me?.organization.id ?? '';

  const [step, setStep] = useState(1);
  const [skipErp, setSkipErp] = useState(false);
  const [selectedErpId, setSelectedErpId] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [testPassed, setTestPassed] = useState(false);
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [testFailed, setTestFailed] = useState(false);
  const [syncPrefs, setSyncPrefs] = useState<SyncPreferences>({
    frequency: '15m',
    syncStock: true,
    syncProduct: true,
    syncInvoice: false,
  });
  const confettiFired = useRef(false);

  const form = useForm<Record<string, string>>({ defaultValues: {} });
  const testErp = useTestErpConnection();
  const createErp = useCreateErpConnection();

  const featuredErps = useMemo(() => {
    const featured = ERP_WIZARD_FEATURED_IDS.filter(
      (id) => ERP_CONNECTION_FORM_FIELDS[id],
    ).map((id) => ({ id, ...getErpDisplay(id) }));

    const rest = ERP_TYPE_IDS.filter(
      (id) =>
        ERP_CONNECTION_FORM_FIELDS[id] &&
        !ERP_WIZARD_FEATURED_IDS.includes(id),
    ).map((id) => ({ id, ...getErpDisplay(id) }));

    return [...featured, ...rest];
  }, []);

  const fieldDefs = useMemo(
    (): ConnectionFormFieldDef[] =>
      selectedErpId ? getErpFormFields(selectedErpId) : [],
    [selectedErpId],
  );

  const platformMeta = selectedErpId ? getErpPlatformMeta(selectedErpId) : undefined;

  const resetWizard = useCallback((): void => {
    setStep(1);
    setSkipErp(false);
    setSelectedErpId(null);
    setFieldErrors({});
    setTestPassed(false);
    setTestMessage(null);
    setTestFailed(false);
    setSyncPrefs({
      frequency: '15m',
      syncStock: true,
      syncProduct: true,
      syncInvoice: false,
    });
    form.reset({});
    confettiFired.current = false;
  }, [form]);

  useEffect(() => {
    if (!open) {
      return;
    }
    resetWizard();
  }, [open, resetWizard]);

  useEffect(() => {
    if (step === STEP_COUNT && !confettiFired.current && !skipErp) {
      confettiFired.current = true;
      void confetti({
        particleCount: 120,
        spread: 70,
        origin: { y: 0.6 },
      });
    }
  }, [step, skipErp]);

  const selectErp = (erpId: string): void => {
    setSkipErp(false);
    setSelectedErpId(erpId);
    setTestPassed(false);
    setTestMessage(null);
    setTestFailed(false);
    form.reset(emptyValuesFromFields(getErpFormFields(erpId)));
    setFieldErrors({});
  };

  const selectNoErp = (): void => {
    setSkipErp(true);
    setSelectedErpId(null);
    setTestPassed(false);
    setTestMessage(null);
    setTestFailed(false);
    form.reset({});
    setFieldErrors({});
  };

  const readCredentials = (): Record<string, string> => {
    const raw = form.getValues();
    const out: Record<string, string> = {};
    for (const f of fieldDefs) {
      out[f.key] = (raw[f.key] ?? '').trim();
    }
    return out;
  };

  const runValidation = (): boolean => {
    const errs = validateFields(fieldDefs, form.getValues());
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleTest = (): void => {
    if (!selectedErpId || !runValidation()) {
      return;
    }
    const credentials = readCredentials();
    testErp.mutate(
      { erpType: selectedErpId, credentials },
      {
        onSuccess: (res) => {
          if (res.connected) {
            setTestPassed(true);
            setTestFailed(false);
            setTestMessage(res.companyName ?? getErpDisplay(selectedErpId).label);
            toast.success('Bağlantı testi başarılı.');
          } else {
            setTestPassed(false);
            setTestFailed(true);
            setTestMessage('Kimlik bilgileri doğrulanamadı.');
            toast.warning('Bağlantı testi başarısız.');
          }
        },
        onError: (error) => {
          setTestPassed(false);
          setTestFailed(true);
          setTestMessage(getApiErrorMessage(error));
          toast.error(getApiErrorMessage(error));
        },
      },
    );
  };

  const finishWizard = (): void => {
    if (skipErp) {
      setStep(STEP_COUNT);
      return;
    }
    if (!selectedErpId || !testPassed) {
      return;
    }
    const credentials = readCredentials();
    createErp.mutate(
      { erpType: selectedErpId, credentials },
      {
        onSuccess: () => {
          if (orgId) {
            saveSyncPreferences(orgId, selectedErpId, syncPrefs);
          }
          setStep(STEP_COUNT);
          toast.success('ERP bağlantısı kuruldu.');
        },
        onError: (error) => {
          toast.error(getApiErrorMessage(error));
        },
      },
    );
  };

  const canProceed = (): boolean => {
    switch (step) {
      case 1:
        return skipErp || selectedErpId !== null;
      case 2:
        return skipErp || testPassed;
      case 3:
        return skipErp || syncPrefs.syncStock || syncPrefs.syncProduct || syncPrefs.syncInvoice;
      case 4:
        return true;
      default:
        return false;
    }
  };

  const goNext = (): void => {
    if (!canProceed()) {
      return;
    }
    if (skipErp && step === 1) {
      setStep(STEP_COUNT);
      return;
    }
    if (step === 3) {
      finishWizard();
      return;
    }
    setStep((s) => Math.min(STEP_COUNT, s + 1));
  };

  const goBack = (): void => {
    if (skipErp && step === STEP_COUNT) {
      setStep(1);
      return;
    }
    setStep((s) => Math.max(1, s - 1));
  };

  const progressPercent = Math.round((step / STEP_COUNT) * 100);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          resetWizard();
        }
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>ERP Kurulum Sihirbazı</DialogTitle>
          <DialogDescription>
            Adım {step}/{STEP_COUNT}: {STEP_LABELS[step - 1]}
          </DialogDescription>
        </DialogHeader>

        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-sky-400 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {step === 1 ? (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Stok, ürün ve fatura akışını otomatikleştirmek için ERP sisteminizi seçin.
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {featuredErps.map((erp) => {
                const selected = !skipErp && selectedErpId === erp.id;
                return (
                  <button
                    key={erp.id}
                    type="button"
                    className={cn(
                      'relative flex flex-col items-center gap-2 rounded-lg border p-4 transition-colors',
                      selected
                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                        : 'border-border hover:border-primary/40',
                    )}
                    onClick={() => selectErp(erp.id)}
                  >
                    {selected ? (
                      <Check
                        className="absolute right-2 top-2 h-4 w-4 text-primary"
                        aria-hidden
                      />
                    ) : null}
                    <span className="text-3xl" aria-hidden>
                      {erp.logo}
                    </span>
                    <span className="text-center text-sm font-medium">{erp.label}</span>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              className={cn(
                'w-full rounded-lg border px-4 py-3 text-left text-sm transition-colors',
                skipErp
                  ? 'border-primary bg-primary/5 font-medium'
                  : 'border-dashed border-border hover:border-primary/40',
              )}
              onClick={() => selectNoErp()}
            >
              ERP kullanmıyorum — şimdilik atla
            </button>
          </div>
        ) : null}

        {step === 2 && selectedErpId && !skipErp ? (
          <div className="space-y-4 py-2">
            <p className="text-sm font-medium">
              {getErpDisplay(selectedErpId).logo} {getErpDisplay(selectedErpId).label}
            </p>
            {platformMeta?.helpText ? (
              <p className="rounded-md border border-sky-100 bg-sky-50 px-3 py-2 text-sm text-sky-900">
                {platformMeta.helpText}
              </p>
            ) : null}
            <Form {...form}>
              <form className="space-y-4">
                {fieldDefs.map((field) => (
                  <FormField
                    key={field.key}
                    control={form.control}
                    name={field.key}
                    render={({ field: rhf }) => (
                      <FormItem>
                        <FormLabel>
                          {field.label}
                          {field.required ? ' *' : ''}
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...rhf}
                            type={
                              field.type === 'password'
                                ? 'password'
                                : field.type === 'number'
                                  ? 'number'
                                  : 'text'
                            }
                            autoComplete="off"
                            placeholder={field.placeholder}
                            aria-invalid={Boolean(fieldErrors[field.key])}
                            className={
                              fieldErrors[field.key] ? 'border-destructive' : undefined
                            }
                            onChange={(e) => {
                              rhf.onChange(e);
                              setTestPassed(false);
                              setTestFailed(false);
                              setTestMessage(null);
                              setFieldErrors((prev) => {
                                if (!prev[field.key]) {
                                  return prev;
                                }
                                const next = { ...prev };
                                delete next[field.key];
                                return next;
                              });
                            }}
                          />
                        </FormControl>
                        {field.hint ? (
                          <p className="text-xs text-muted-foreground">{field.hint}</p>
                        ) : null}
                        {fieldErrors[field.key] ? (
                          <p className="text-destructive text-sm">{fieldErrors[field.key]}</p>
                        ) : null}
                      </FormItem>
                    )}
                  />
                ))}
              </form>
            </Form>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={testErp.isPending}
                onClick={() => handleTest()}
              >
                {testErp.isPending ? 'Test ediliyor…' : 'Bağlantıyı Test Et'}
              </Button>
              {testErp.isPending ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Test ediliyor…
                </div>
              ) : null}
              {testPassed && testMessage ? (
                <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">
                  <CheckCircle2 className="h-4 w-4" aria-hidden />
                  {testMessage}
                </div>
              ) : null}
              {testFailed && testMessage ? (
                <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
                  <XCircle className="h-4 w-4" aria-hidden />
                  {testMessage}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {step === 3 && selectedErpId && !skipErp ? (
          <div className="space-y-6 py-2">
            <div className="space-y-3">
              <Label>Ne sıklıkla senkronize edilsin?</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {FREQUENCY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={cn(
                      'rounded-lg border px-4 py-3 text-left text-sm transition-colors',
                      syncPrefs.frequency === opt.value
                        ? 'border-primary bg-primary/5 font-medium'
                        : 'border-border hover:border-primary/40',
                    )}
                    onClick={() =>
                      setSyncPrefs((p) => ({ ...p, frequency: opt.value }))
                    }
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <Label>Hangi veriler eşitlensin?</Label>
              <div className="space-y-3">
                {[
                  { key: 'syncStock' as const, label: 'Stok' },
                  { key: 'syncProduct' as const, label: 'Ürün' },
                  { key: 'syncInvoice' as const, label: 'Fatura' },
                ].map((item) => (
                  <div key={item.key} className="flex items-center gap-2">
                    <Checkbox
                      id={`sync-${item.key}`}
                      checked={syncPrefs[item.key]}
                      onCheckedChange={(checked) => {
                        setSyncPrefs((p) => ({
                          ...p,
                          [item.key]: checked === true,
                        }));
                      }}
                    />
                    <Label htmlFor={`sync-${item.key}`} className="font-normal">
                      {item.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {step === STEP_COUNT ? (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <Sparkles className="h-12 w-12 text-sky-400" aria-hidden />
            {skipErp ? (
              <>
                <h3 className="text-xl font-semibold">ERP adımı atlandı</h3>
                <p className="max-w-sm text-sm text-muted-foreground">
                  İstediğiniz zaman Bağlantılar sayfasından ERP ekleyebilirsiniz.
                </p>
              </>
            ) : createErp.isPending ? (
              <>
                <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">ERP bağlantısı kuruluyor…</p>
              </>
            ) : (
              <>
                <h3 className="text-xl font-semibold">ERP bağlantısı kuruldu!</h3>
                <p className="max-w-sm text-sm text-muted-foreground">
                  {selectedErpId
                    ? `${getErpDisplay(selectedErpId).label} entegrasyonunuz hazır. Senkronizasyon tercihleriniz kaydedildi.`
                    : 'Entegrasyonunuz hazır.'}
                </p>
              </>
            )}
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-2 border-t pt-4">
          <Button
            type="button"
            variant="outline"
            disabled={step === 1 || createErp.isPending}
            onClick={() => goBack()}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Geri
          </Button>
          {step < STEP_COUNT ? (
            <Button
              type="button"
              disabled={!canProceed() || testErp.isPending || createErp.isPending}
              onClick={() => goNext()}
            >
              {step === 3 ? 'Kurulumu Tamamla' : 'İleri'}
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => {
                onOpenChange(false);
                onCompleted?.();
              }}
              disabled={!skipErp && createErp.isPending}
            >
              Kapat
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
