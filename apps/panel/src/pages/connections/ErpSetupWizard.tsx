import confetti from 'canvas-confetti';
import type { ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

import { SearchableCombobox } from '@/components/SearchableCombobox';
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
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ErpSyncFrequency } from '@/hooks/useErpSyncSettings';
import { useAuth } from '@/hooks/useAuth';
import { api, getApiErrorMessage } from '@/lib/api';
import { getConnectionErrorHint } from '@/lib/connection-error-hints';
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

const STEP_COUNT = 5;
const STEP_LABELS = [
  'ERP Seç',
  'Bağlantı Bilgileri',
  'Test',
  'Eşitleme',
  'İlk Sync',
] as const;

type SyncFrequency = 'realtime' | '15m' | '1h' | 'manual';

interface SyncPreferences {
  frequency: SyncFrequency;
  syncStock: boolean;
  syncProduct: boolean;
  syncInvoice: boolean;
}

const FREQUENCY_OPTIONS: { value: SyncFrequency; label: string }[] = [
  { value: 'realtime', label: 'Anlık' },
  { value: '15m', label: '15 dakika' },
  { value: '1h', label: '1 saat' },
  { value: 'manual', label: 'Manuel' },
];

const FREQ_TO_API: Record<SyncFrequency, ErpSyncFrequency> = {
  realtime: 'REALTIME',
  '15m': 'EVERY_15_MIN',
  '1h': 'HOURLY',
  manual: 'MANUAL',
};

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

interface WizardContentProps {
  variant: 'modal' | 'page';
  onClose?: () => void;
}

export function ErpSetupWizardContent({
  variant,
  onClose,
}: WizardContentProps): ReactElement {
  const navigate = useNavigate();
  const { data: me } = useAuth();

  const [step, setStep] = useState(1);
  const [erpSearch, setErpSearch] = useState('');
  const [selectedErpId, setSelectedErpId] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [testPassed, setTestPassed] = useState(false);
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [testFailed, setTestFailed] = useState(false);
  const [testProgress, setTestProgress] = useState(0);
  const [createdConnectionId, setCreatedConnectionId] = useState<string | null>(null);
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
    const q = erpSearch.trim().toLowerCase();
    const all = ERP_TYPE_IDS.filter((id) => ERP_CONNECTION_FORM_FIELDS[id]).map(
      (id) => ({ id, ...getErpDisplay(id) }),
    );
    if (!q) {
      const featured = ERP_WIZARD_FEATURED_IDS.filter(
        (id) => ERP_CONNECTION_FORM_FIELDS[id],
      ).map((id) => ({ id, ...getErpDisplay(id) }));
      const rest = all.filter((e) => !ERP_WIZARD_FEATURED_IDS.includes(e.id));
      return [...featured, ...rest];
    }
    return all.filter(
      (e) =>
        e.label.toLowerCase().includes(q) || e.id.toLowerCase().includes(q),
    );
  }, [erpSearch]);

  const erpComboboxOptions = useMemo(
    () =>
      ERP_TYPE_IDS.filter((id) => ERP_CONNECTION_FORM_FIELDS[id]).map((id) => {
        const d = getErpDisplay(id);
        return { value: id, label: d.label, logo: d.logo };
      }),
    [],
  );

  const fieldDefs = useMemo(
    (): ConnectionFormFieldDef[] =>
      selectedErpId ? getErpFormFields(selectedErpId) : [],
    [selectedErpId],
  );

  const platformMeta = selectedErpId ? getErpPlatformMeta(selectedErpId) : undefined;

  const queryClient = useQueryClient();

  const upsertSyncMutation = useMutation({
    mutationFn: async (input: {
      connectionId: string;
      syncFrequency: ErpSyncFrequency;
      syncStock: boolean;
      syncProducts: boolean;
      syncInvoices: boolean;
    }): Promise<void> => {
      await api.put(`/erp-connections/${input.connectionId}/sync-settings`, {
        syncFrequency: input.syncFrequency,
        syncStock: input.syncStock,
        syncProducts: input.syncProducts,
        syncInvoices: input.syncInvoices,
      });
    },
  });

  const triggerSyncMutation = useMutation({
    mutationFn: async (connectionId: string): Promise<void> => {
      await api.post(`/erp-connections/${connectionId}/sync-now`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['erp-connections'] });
    },
  });

  const resetWizard = useCallback((): void => {
    setStep(1);
    setErpSearch('');
    setSelectedErpId(null);
    setFieldErrors({});
    setTestPassed(false);
    setTestMessage(null);
    setTestFailed(false);
    setTestProgress(0);
    setCreatedConnectionId(null);
    setSyncPrefs({
      frequency: '15m',
      syncStock: true,
      syncProduct: true,
      syncInvoice: false,
    });
    form.reset({});
    confettiFired.current = false;
  }, [form]);

  const selectErp = (erpId: string): void => {
    setSelectedErpId(erpId);
    setTestPassed(false);
    setTestMessage(null);
    setTestFailed(false);
    form.reset(emptyValuesFromFields(getErpFormFields(erpId)));
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

  useEffect(() => {
    if (!testErp.isPending) {
      return;
    }
    setTestProgress(12);
    const interval = window.setInterval(() => {
      setTestProgress((p) => Math.min(p + 8, 92));
    }, 280);
    return () => {
      window.clearInterval(interval);
    };
  }, [testErp.isPending]);

  const handleTest = (): void => {
    if (!selectedErpId || !runValidation()) {
      return;
    }
    const credentials = readCredentials();
    testErp.mutate(
      { erpType: selectedErpId, credentials },
      {
        onSuccess: (res) => {
          setTestProgress(100);
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
          setTestProgress(100);
          setTestPassed(false);
          setTestFailed(true);
          const msg = getApiErrorMessage(error);
          const hint = getConnectionErrorHint(msg);
          setTestMessage(hint ? `${msg} — ${hint}` : msg);
          toast.error(msg);
        },
      },
    );
  };

  const createConnection = (): void => {
    if (!selectedErpId || !testPassed) {
      return;
    }
    createErp.mutate(
      { erpType: selectedErpId, credentials: readCredentials() },
      {
        onSuccess: (conn) => {
          setCreatedConnectionId(conn.id);
          setStep(5);
          toast.success('ERP bağlantısı kaydedildi.');
        },
        onError: (error) => {
          toast.error(getApiErrorMessage(error));
        },
      },
    );
  };

  const runFirstSync = (): void => {
    if (!createdConnectionId) {
      return;
    }
    upsertSyncMutation.mutate(
      {
        connectionId: createdConnectionId,
        syncFrequency: FREQ_TO_API[syncPrefs.frequency],
        syncStock: syncPrefs.syncStock,
        syncProducts: syncPrefs.syncProduct,
        syncInvoices: syncPrefs.syncInvoice,
      },
      {
        onSuccess: () => {
          triggerSyncMutation.mutate(createdConnectionId, {
            onSuccess: () => {
              if (!confettiFired.current) {
                confettiFired.current = true;
                void confetti({ particleCount: 140, spread: 72, origin: { y: 0.55 } });
              }
              toast.success('İlk senkronizasyon kuyruğa alındı.');
              if (variant === 'page') {
                navigate('/connections');
              } else {
                onClose?.();
              }
            },
            onError: (error) => {
              toast.error(getApiErrorMessage(error));
            },
          });
        },
        onError: (error) => {
          toast.error(getApiErrorMessage(error));
        },
      },
    );
  };

  const goNext = (): void => {
    if (step === 2) {
      if (!runValidation()) {
        return;
      }
      setStep(3);
      return;
    }
    if (step === 4) {
      createConnection();
      return;
    }
    if (step === 1 && !selectedErpId) {
      return;
    }
    setStep((s) => Math.min(STEP_COUNT, s + 1));
  };

  const goBack = (): void => {
    setStep((s) => Math.max(1, s - 1));
  };

  const progressPercent = Math.round((step / STEP_COUNT) * 100);

  const body = (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>
            Adım {step}/{STEP_COUNT}: {STEP_LABELS[step - 1]}
          </span>
          <span>{progressPercent}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-sky-400 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {step === 1 ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Stok, ürün ve fatura akışını otomatikleştirmek için ERP sisteminizi seçin.
          </p>
          <SearchableCombobox
            options={erpComboboxOptions}
            value={selectedErpId}
            onChange={selectErp}
            placeholder="ERP ara ve seç…"
            searchPlaceholder="Logo, Mikro, Paraşüt…"
          />
          <Input
            type="search"
            placeholder="Listede filtrele…"
            value={erpSearch}
            onChange={(e) => setErpSearch(e.target.value)}
            aria-label="ERP filtrele"
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {featuredErps.slice(0, 12).map((erp) => {
              const selected = selectedErpId === erp.id;
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
        </div>
      ) : null}

      {step === 2 && selectedErpId ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3">
            <span className="text-3xl" aria-hidden>
              {getErpDisplay(selectedErpId).logo}
            </span>
            <p className="font-semibold">{getErpDisplay(selectedErpId).label}</p>
          </div>
          {platformMeta?.helpText || platformMeta?.docsUrl ? (
            <details className="group rounded-md border border-sky-100 bg-sky-50 text-sm text-sky-900">
              <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 font-medium [&::-webkit-details-marker]:hidden">
                API bilgileri nasıl alınır?
                <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
              </summary>
              <div className="space-y-2 border-t border-sky-100 px-3 py-2">
                {platformMeta.helpText ? <p>{platformMeta.helpText}</p> : null}
                {platformMeta.docsUrl ? (
                  <a
                    href={platformMeta.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium underline"
                  >
                    Dokümantasyon →
                  </a>
                ) : null}
              </div>
            </details>
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
                      {fieldErrors[field.key] ? (
                        <p className="text-destructive text-sm">{fieldErrors[field.key]}</p>
                      ) : null}
                    </FormItem>
                  )}
                />
              ))}
            </form>
          </Form>
        </div>
      ) : null}

      {step === 3 && selectedErpId ? (
        <div className="space-y-6 py-4">
          <p className="text-sm text-muted-foreground">
            Bağlantı bilgilerinizi doğruluyoruz. Test başarılı olmadan devam edemezsiniz.
          </p>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-sky-400 transition-all duration-300"
              style={{
                width: `${testErp.isPending ? testProgress : testPassed || testFailed ? 100 : 0}%`,
              }}
            />
          </div>
          <Button
            type="button"
            className="w-full sm:w-auto"
            variant="secondary"
            disabled={testErp.isPending}
            onClick={() => handleTest()}
          >
            {testErp.isPending ? 'Test ediliyor…' : 'Bağlantıyı Test Et'}
          </Button>
          {testPassed && testMessage ? (
            <div className="flex items-start gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{testMessage}</span>
            </div>
          ) : null}
          {testFailed && testMessage ? (
            <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{testMessage}</span>
            </div>
          ) : null}
        </div>
      ) : null}

      {step === 4 && selectedErpId ? (
        <div className="space-y-6">
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
            {[
              { key: 'syncStock' as const, label: 'Stok' },
              { key: 'syncProduct' as const, label: 'Ürün' },
              { key: 'syncInvoice' as const, label: 'Fatura' },
            ].map((item) => (
              <div key={item.key} className="flex items-center gap-2">
                <Checkbox
                  id={`erp-sync-${item.key}`}
                  checked={syncPrefs[item.key]}
                  onCheckedChange={(checked) => {
                    setSyncPrefs((p) => ({
                      ...p,
                      [item.key]: checked === true,
                    }));
                  }}
                />
                <Label htmlFor={`erp-sync-${item.key}`} className="font-normal">
                  {item.label}
                </Label>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {step === 5 ? (
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          {createErp.isPending ? (
            <>
              <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">ERP bağlantısı kuruluyor…</p>
            </>
          ) : (
            <>
              <Sparkles className="h-12 w-12 text-sky-400" aria-hidden />
              <h3 className="text-xl font-semibold">Bağlantı hazır</h3>
              <p className="max-w-sm text-sm text-muted-foreground">
                İlk senkronizasyonu başlatarak verilerinizi panele aktarın.
              </p>
              <Button
                type="button"
                size="lg"
                disabled={
                  upsertSyncMutation.isPending || triggerSyncMutation.isPending
                }
                onClick={() => runFirstSync()}
              >
                {triggerSyncMutation.isPending || upsertSyncMutation.isPending
                  ? 'Senkronizasyon başlatılıyor…'
                  : 'İlk Senkronizasyonu Başlat'}
              </Button>
            </>
          )}
        </div>
      ) : null}

      {step < 5 ? (
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
          <Button
            type="button"
            disabled={
              (step === 3 && !testPassed) ||
              testErp.isPending ||
              createErp.isPending ||
              (step === 1 && !selectedErpId) ||
              (step === 4 &&
                !(
                  syncPrefs.syncStock ||
                  syncPrefs.syncProduct ||
                  syncPrefs.syncInvoice
                ))
            }
            onClick={() => goNext()}
          >
            {step === 4 ? 'Bağlantıyı Kur' : 'İleri'}
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      ) : null}
    </div>
  );

  if (variant === 'page') {
    return (
      <div>
        <h1 className="mb-2 text-2xl font-semibold tracking-tight">ERP Kurulum Sihirbazı</h1>
        <p className="mb-6 text-muted-foreground">
          {me?.organization.name} için ERP entegrasyonunu adım adım tamamlayın.
        </p>
        {body}
      </div>
    );
  }

  return body;
}

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleted?: () => void;
}

export function ErpSetupWizard({
  open,
  onOpenChange,
  onCompleted,
}: ModalProps): ReactElement {
  const [wizardKey, setWizardKey] = useState(0);

  useEffect(() => {
    if (open) {
      setWizardKey((k) => k + 1);
    }
  }, [open]);

  const handleClose = (): void => {
    onOpenChange(false);
    onCompleted?.();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>ERP Kurulum Sihirbazı</DialogTitle>
          <DialogDescription>
            Bağlantı, test ve ilk senkronizasyon adımlarını tamamlayın.
          </DialogDescription>
        </DialogHeader>
        <ErpSetupWizardContent key={wizardKey} variant="modal" onClose={handleClose} />
      </DialogContent>
    </Dialog>
  );
}
