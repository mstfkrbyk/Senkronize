import confetti from 'canvas-confetti';
import type { ReactElement } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
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
import { ErpProductImportModeFields } from '@/components/connections/ErpProductImportModeFields';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useCreateErpConnection,
  useErpConnections,
  useTestErpConnection,
} from '@/hooks/useErpConnections';
import type { ErpProductImportMode } from '@/hooks/useErpSyncSettings';
import { useSubscriptionUsage } from '@/hooks/useSubscriptionUsage';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { api, getApiErrorMessage } from '@/lib/api';
import {
  ERP_CONNECTION_FORM_FIELDS,
  ERP_TYPE_IDS,
  ERP_WIZARD_FEATURED_IDS,
  getErpFormFields,
  getErpPlatformMeta,
  type ConnectionFormFieldDef,
} from '@/lib/connection-form-fields';
import {
  applyConnectionFieldDefaults,
  emptyConnectionFormValues,
  validateConnectionFields,
} from '@/lib/connection-form-values';
import {
  formatConnectionTestFailureMessage,
  formatErpTestSuccessMessage,
  normalizeErpTestConnectionResult,
} from '@/lib/connection-test-message';
import { FORM_MESSAGES } from '@/lib/form-messages';
import { erpConnectionRoleHint, erpConnectionRoleLabel } from '@/lib/erp-connection-display';
import { erpSlotUsageLabel, isErpSlotQuotaFull } from '@/lib/erp-slot-usage';
import { getErpDisplay } from '@/lib/platform-display';
import { cn } from '@/lib/utils';
import { ConnectionCredentialField } from '@/pages/connections/forms/ConnectionCredentialField';

const STEP_COUNT = 5;
const STEP_LABELS = [
  'ERP Seç',
  'Bağlantı Bilgileri',
  'Test',
  'Kapsam ve eşitleme',
  'İlk Sync',
] as const;

type SyncPreferences = {
  syncStock: boolean;
  syncProduct: boolean;
  syncInvoice: boolean;
};

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
    syncStock: true,
    syncProduct: true,
    syncInvoice: false,
  });
  const [displayName, setDisplayName] = useState('');
  const [connectionRole, setConnectionRole] = useState<'PRIMARY' | 'SECONDARY'>('PRIMARY');
  const [productImportMode, setProductImportMode] =
    useState<ErpProductImportMode>('ECOMMERCE_ONLY');
  const [erpCategoryIds, setErpCategoryIds] = useState<string[]>([]);
  const confettiFired = useRef(false);

  const erpConnectionsQuery = useErpConnections();
  const usageQuery = useSubscriptionUsage(true);
  const hasPrimaryErp = (erpConnectionsQuery.data ?? []).some((c) => c.role === 'PRIMARY');
  const erpSlotFull = isErpSlotQuotaFull(usageQuery.data);
  const erpSlotLimit = usageQuery.data?.usage.erpConnections?.limit ?? null;
  const isSecondaryRole = hasPrimaryErp || connectionRole === 'SECONDARY';

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
      syncStock: boolean;
      syncProducts: boolean;
      syncInvoices: boolean;
      productImportMode?: ErpProductImportMode;
      erpCategoryIds?: string[];
    }): Promise<void> => {
      await api.put(`/erp-connections/${input.connectionId}/sync-settings`, {
        syncStock: input.syncStock,
        syncProducts: input.syncProducts,
        syncInvoices: input.syncInvoices,
        productImportMode: input.productImportMode,
        erpCategoryIds: input.erpCategoryIds,
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

  const selectErp = (erpId: string): void => {
    setSelectedErpId(erpId);
    setTestPassed(false);
    setTestMessage(null);
    setTestFailed(false);
    form.reset(emptyConnectionFormValues(getErpFormFields(erpId)));
    setFieldErrors({});
  };

  const readCredentials = (): Record<string, string> => {
    const raw = form.getValues();
    const trimmed: Record<string, string> = {};
    for (const f of fieldDefs) {
      trimmed[f.key] = (raw[f.key] ?? '').trim();
    }
    const withDefaults = applyConnectionFieldDefaults(fieldDefs, trimmed);
    if (!selectedErpId) {
      return withDefaults;
    }
    return normalizeErpCredentials(selectedErpId, withDefaults);
  };

  const runValidation = (): boolean => {
    const errs = validateConnectionFields(fieldDefs, form.getValues(), {
      required: FORM_MESSAGES.required,
    });
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
          const normalized = normalizeErpTestConnectionResult(res);
          if (normalized.connected) {
            setTestPassed(true);
            setTestFailed(false);
            setTestMessage(formatErpTestSuccessMessage(normalized));
            toast.success('Bağlantı testi başarılı.');
          } else {
            setTestPassed(false);
            setTestFailed(true);
            setTestMessage(
              formatConnectionTestFailureMessage(
                normalized.message,
                'Kimlik bilgileri doğrulanamadı.',
              ),
            );
            toast.warning('Bağlantı testi başarısız.');
          }
        },
        onError: (error) => {
          setTestProgress(100);
          setTestPassed(false);
          setTestFailed(true);
          const msg = getApiErrorMessage(error);
          setTestMessage(formatConnectionTestFailureMessage(msg));
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
      {
        erpType: selectedErpId,
        credentials: readCredentials(),
        ...(displayName.trim() ? { displayName: displayName.trim() } : {}),
        role: hasPrimaryErp ? 'SECONDARY' : connectionRole,
      },
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
        syncStock: syncPrefs.syncStock,
        syncProducts: syncPrefs.syncProduct,
        syncInvoices: isSecondaryRole ? false : syncPrefs.syncInvoice,
        ...(selectedErpId === 'BIZIMHESAP' && syncPrefs.syncProduct
          ? {
              productImportMode,
              erpCategoryIds:
                productImportMode === 'CATEGORY' ? erpCategoryIds : [],
            }
          : {}),
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

  const body = erpSlotFull ? (
    <div className="space-y-4 py-8 text-center">
      <p className="text-sm font-medium">ERP bağlantı kotası dolu</p>
      <p className="text-sm text-muted-foreground">
        Paketinizde {erpSlotUsageLabel(usageQuery.data)} ERP bağlantısı var. Ek bağlantı için
        abonelikte ERP modülü satın alın veya yönetici ek slot tanımlasın.
      </p>
      {variant === 'page' ? (
        <Button type="button" variant="outline" onClick={() => navigate('/connections')}>
          Entegrasyonlara dön
        </Button>
      ) : null}
    </div>
  ) : (
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
          <div className="space-y-2">
            <Label htmlFor="erp-wizard-display-name">Bağlantı adı</Label>
            <Input
              id="erp-wizard-display-name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder={
                hasPrimaryErp ? 'Örn. BizimHesap İLKİŞ (stok)' : 'Örn. BizimHesap MIX'
              }
              maxLength={120}
            />
            <p className="text-xs text-muted-foreground">
              Panelde bağlantıları ayırt etmek için kısa bir isim verin.
            </p>
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
                        <ConnectionCredentialField
                          field={field}
                          rhf={rhf}
                          hasError={Boolean(fieldErrors[field.key])}
                          onValueChange={() => {
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
                      {field.hint && !fieldErrors[field.key] ? (
                        <p className="text-muted-foreground text-xs">{field.hint}</p>
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
        </div>
      ) : null}

      {step === 3 && selectedErpId ? (
        <div className="space-y-6 py-4">
          {selectedErpId === 'BIZIMHESAP' ? (
            <>
              <p className="text-sm text-muted-foreground">
                BizimHesap saatlik API kotası sınırlı olduğu için canlı bağlantı testi
                yapılmaz. Token alanı doluysa bir sonraki adıma geçebilirsiniz; ilk gerçek
                doğrulama ürün senkronu sırasında olur.
              </p>
              <Button
                type="button"
                className="w-full sm:w-auto"
                variant="secondary"
                onClick={() => {
                  if (!runValidation()) {
                    return;
                  }
                  setTestPassed(true);
                  setTestFailed(false);
                  setTestMessage('Token formatı doğrulandı (canlı API çağrısı yapılmadı).');
                }}
              >
                Token alanlarını kontrol et
              </Button>
            </>
          ) : (
            <>
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
            </>
          )}
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
          <p className="text-sm text-muted-foreground">
            Senkronizasyon sıklığı Senkronize tarafından otomatik belirlenir.
            {selectedErpId === 'BIZIMHESAP'
              ? ' BizimHesap API kotası: saatte en fazla 10 istek (~6 dakikada bir).'
              : null}
          </p>

          {hasPrimaryErp ? (
            <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm">
              <p className="font-medium">{erpConnectionRoleLabel('SECONDARY')}</p>
              <p className="text-muted-foreground">{erpConnectionRoleHint('SECONDARY')}</p>
            </div>
          ) : erpSlotLimit !== null && erpSlotLimit > 1 ? (
            <div className="space-y-2">
              <Label htmlFor="erp-wizard-role">ERP rolü</Label>
              <Select
                value={connectionRole}
                onValueChange={(value) => {
                  const role = value === 'SECONDARY' ? 'SECONDARY' : 'PRIMARY';
                  setConnectionRole(role);
                  if (role === 'SECONDARY') {
                    setSyncPrefs((p) => ({ ...p, syncInvoice: false }));
                  }
                }}
              >
                <SelectTrigger id="erp-wizard-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PRIMARY">
                    Birincil — fatura ve ERP&apos;ye yazma
                  </SelectItem>
                  <SelectItem value="SECONDARY">
                    İkincil — yalnızca stok/ürün okuma
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {erpConnectionRoleHint(connectionRole)}
              </p>
            </div>
          ) : (
            <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm">
              <p className="font-medium">{erpConnectionRoleLabel('PRIMARY')}</p>
              <p className="text-muted-foreground">{erpConnectionRoleHint('PRIMARY')}</p>
            </div>
          )}

          <div className="space-y-3">
            <Label>Hangi veriler eşitlensin?</Label>
            {[
              { key: 'syncStock' as const, label: 'Stok' },
              { key: 'syncProduct' as const, label: 'Ürün' },
              {
                key: 'syncInvoice' as const,
                label: 'Fatura',
                disabled: isSecondaryRole,
              },
            ].map((item) => (
              <div key={item.key} className="flex items-center gap-2">
                <Checkbox
                  id={`erp-sync-${item.key}`}
                  checked={item.disabled ? false : syncPrefs[item.key]}
                  disabled={item.disabled}
                  onCheckedChange={(checked) => {
                    setSyncPrefs((p) => ({
                      ...p,
                      [item.key]: checked === true,
                    }));
                  }}
                />
                <Label htmlFor={`erp-sync-${item.key}`} className="font-normal">
                  {item.label}
                  {item.disabled ? ' (birincil ERP gerekir)' : ''}
                </Label>
              </div>
            ))}
          </div>

          {selectedErpId === 'BIZIMHESAP' && syncPrefs.syncProduct ? (
            <ErpProductImportModeFields
              productImportMode={productImportMode}
              erpCategoryIds={erpCategoryIds}
              onProductImportModeChange={(mode) => {
                setProductImportMode(mode);
                if (mode !== 'CATEGORY') {
                  setErpCategoryIds([]);
                }
              }}
              onCategoryIdsChange={setErpCategoryIds}
              idPrefix="erp-wizard-import"
            />
          ) : null}
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
                  (!isSecondaryRole && syncPrefs.syncInvoice)
                )) ||
              (step === 4 &&
                productImportMode === 'CATEGORY' &&
                syncPrefs.syncProduct &&
                selectedErpId === 'BIZIMHESAP' &&
                erpCategoryIds.length === 0)
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
