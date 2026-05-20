import confetti from 'canvas-confetti';
import type { ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  ChevronDown,
  Eye,
  EyeOff,
  CheckCircle2,
  Loader2,
  Sparkles,
  XCircle,
} from 'lucide-react';
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
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
  useCreateConnection,
  useTestConnection,
  useTriggerManualSync,
  useUpdateMarketplaceConnection,
} from '@/hooks/useConnections';
import {
  useCreateErpConnection,
  useTestErpConnection,
  useUpdateErpConnection,
  type ErpConnectionDto,
} from '@/hooks/useErpConnections';
import { track } from '@/lib/analytics';
import { getApiErrorMessage } from '@/lib/api';
import {
  ECOMMERCE_MARKETPLACE_IDS,
  ERP_CONNECTION_FORM_FIELDS,
  ERP_TYPE_IDS,
  getErpPlatformMeta,
  getMarketplacePlatformMeta,
  MARKETPLACE_CONNECTION_FORM_FIELDS,
  MARKETPLACE_PLATFORM_IDS,
  type ConnectionFormFieldDef,
  type ConnectionPlatformMeta,
} from '@/lib/connection-form-fields';
import { getConnectionErrorHint } from '@/lib/connection-error-hints';
import { FORM_MESSAGES, isValidHttpOrHttpsUrl } from '@/lib/form-messages';
import { getErpDisplay, getMarketplaceDisplay } from '@/lib/platform-display';
import type { MarketplaceConnectionDto } from '@/types/connection';

export type ConnectionFormModalConfig =
  | {
      kind: 'marketplace';
      mode: 'create';
      listFilter: 'marketplace' | 'ecommerce';
    }
  | {
      kind: 'marketplace';
      mode: 'edit';
      connection: MarketplaceConnectionDto;
    }
  | { kind: 'erp'; mode: 'create' }
  | { kind: 'erp'; mode: 'edit'; connection: ErpConnectionDto };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: ConnectionFormModalConfig | null;
}

type TestOutcome = 'idle' | 'success' | 'fail';

interface TestResultState {
  ok: boolean;
  message: string;
}

const ECOMMERCE_PLATFORM_SET = new Set<string>(ECOMMERCE_MARKETPLACE_IDS);

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

export function ConnectionFormModal({
  open,
  onOpenChange,
  config,
}: Props): ReactElement {
  const [testOutcome, setTestOutcome] = useState<TestOutcome>('idle');
  const [testResult, setTestResult] = useState<TestResultState | null>(null);
  const [visibleSecrets, setVisibleSecrets] = useState<Record<string, boolean>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [syncStarting, setSyncStarting] = useState(false);

  const form = useForm<Record<string, string>>({
    defaultValues: {},
  });

  const marketplaceIds = useMemo((): string[] => {
    if (!config || config.kind !== 'marketplace' || config.mode !== 'create') {
      return [];
    }
    const pool =
      config.listFilter === 'ecommerce'
        ? ECOMMERCE_MARKETPLACE_IDS
        : MARKETPLACE_PLATFORM_IDS;
    return pool.filter((id) => MARKETPLACE_CONNECTION_FORM_FIELDS[id]);
  }, [config]);

  const erpIds = useMemo((): string[] => {
    if (!config || config.kind !== 'erp' || config.mode !== 'create') {
      return [];
    }
    return ERP_TYPE_IDS.filter((id) => ERP_CONNECTION_FORM_FIELDS[id]);
  }, [config]);

  const [selectedMarketplaceId, setSelectedMarketplaceId] = useState<string>('');
  const [selectedErpId, setSelectedErpId] = useState<string>('');

  const marketplaceFieldDefs = useMemo((): ConnectionFormFieldDef[] => {
    if (!config || config.kind !== 'marketplace') {
      return [];
    }
    if (config.mode === 'edit') {
      return MARKETPLACE_CONNECTION_FORM_FIELDS[config.connection.platform] ?? [];
    }
    return MARKETPLACE_CONNECTION_FORM_FIELDS[selectedMarketplaceId] ?? [];
  }, [config, selectedMarketplaceId]);

  const erpFieldDefs = useMemo((): ConnectionFormFieldDef[] => {
    if (!config || config.kind !== 'erp') {
      return [];
    }
    if (config.mode === 'edit') {
      return ERP_CONNECTION_FORM_FIELDS[config.connection.erpType] ?? [];
    }
    return ERP_CONNECTION_FORM_FIELDS[selectedErpId] ?? [];
  }, [config, selectedErpId]);

  const activeFieldDefs =
    config?.kind === 'marketplace' ? marketplaceFieldDefs : erpFieldDefs;

  const resetFormForFields = useCallback(
    (fields: ConnectionFormFieldDef[]): void => {
      const init = emptyValuesFromFields(fields);
      form.reset(init);
      setFieldErrors({});
      setTestOutcome('idle');
      setTestResult(null);
      setVisibleSecrets({});
    },
    [form],
  );

  useEffect(() => {
    if (!open || !config) {
      return;
    }
    setTestOutcome('idle');
    setTestResult(null);
    setFieldErrors({});
    setSaveSuccess(false);
    setSyncStarting(false);
    if (config.kind === 'marketplace' && config.mode === 'create') {
      const first = marketplaceIds[0] ?? '';
      setSelectedMarketplaceId(first);
      const defs = MARKETPLACE_CONNECTION_FORM_FIELDS[first] ?? [];
      resetFormForFields(defs);
    } else if (config.kind === 'marketplace' && config.mode === 'edit') {
      const defs =
        MARKETPLACE_CONNECTION_FORM_FIELDS[config.connection.platform] ?? [];
      resetFormForFields(defs);
    } else if (config.kind === 'erp' && config.mode === 'create') {
      const first = erpIds[0] ?? '';
      setSelectedErpId(first);
      const defs = ERP_CONNECTION_FORM_FIELDS[first] ?? [];
      resetFormForFields(defs);
    } else if (config.kind === 'erp' && config.mode === 'edit') {
      const defs = ERP_CONNECTION_FORM_FIELDS[config.connection.erpType] ?? [];
      resetFormForFields(defs);
    }
  }, [open, config, marketplaceIds, erpIds, resetFormForFields]);

  const testMp = useTestConnection();
  const testErp = useTestErpConnection();
  const triggerSync = useTriggerManualSync();
  const createMp = useCreateConnection();
  const createErp = useCreateErpConnection();
  const updateMp = useUpdateMarketplaceConnection();
  const updateErp = useUpdateErpConnection();

  const title = useMemo((): string => {
    if (!config) {
      return 'Bağlantı';
    }
    if (config.kind === 'marketplace') {
      return config.mode === 'create'
        ? 'Pazaryeri / mağaza bağlantısı ekle'
        : 'Bağlantıyı düzenle';
    }
    return config.mode === 'create' ? 'ERP bağlantısı ekle' : 'ERP bağlantısını düzenle';
  }, [config]);

  const handleMarketplacePlatformChange = (value: string): void => {
    setSelectedMarketplaceId(value);
    const defs = MARKETPLACE_CONNECTION_FORM_FIELDS[value] ?? [];
    resetFormForFields(defs);
  };

  const handleErpTypeChange = (value: string): void => {
    setSelectedErpId(value);
    const defs = ERP_CONNECTION_FORM_FIELDS[value] ?? [];
    resetFormForFields(defs);
  };

  const readCredentials = (): Record<string, string> => {
    const raw = form.getValues();
    const out: Record<string, string> = {};
    for (const f of activeFieldDefs) {
      out[f.key] = (raw[f.key] ?? '').trim();
    }
    return out;
  };

  const runValidation = (): boolean => {
    const values = form.getValues();
    const errs = validateFields(activeFieldDefs, values);
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const activePlatformId = useMemo((): string => {
    if (!config) {
      return '';
    }
    if (config.kind === 'marketplace') {
      return config.mode === 'edit' ? config.connection.platform : selectedMarketplaceId;
    }
    return config.mode === 'edit' ? config.connection.erpType : selectedErpId;
  }, [config, selectedMarketplaceId, selectedErpId]);

  const activeDisplay = useMemo(() => {
    if (!activePlatformId) {
      return null;
    }
    return config?.kind === 'marketplace'
      ? getMarketplaceDisplay(activePlatformId)
      : getErpDisplay(activePlatformId);
  }, [activePlatformId, config?.kind]);

  const platformMeta = useMemo((): ConnectionPlatformMeta | undefined => {
    if (!config) {
      return undefined;
    }
    if (config.kind === 'marketplace') {
      const platform =
        config.mode === 'edit' ? config.connection.platform : selectedMarketplaceId;
      return getMarketplacePlatformMeta(platform);
    }
    const erpType = config.mode === 'edit' ? config.connection.erpType : selectedErpId;
    return getErpPlatformMeta(erpType);
  }, [config, selectedMarketplaceId, selectedErpId]);

  const deriveMarketplaceTestMessage = (
    credentials: Record<string, string>,
  ): string => {
    const label =
      credentials.sellerId ??
      credentials.merchantId ??
      credentials.username ??
      credentials.storeUrl ??
      credentials.shopDomain;
    return label ? `Mağaza: ${label}` : 'Bağlantı doğrulandı';
  };

  const handleTest = (): void => {
    if (!config) {
      return;
    }
    const isEditWithStoredCreds =
      (config.kind === 'marketplace' && config.mode === 'edit') ||
      (config.kind === 'erp' && config.mode === 'edit');
    if (!isEditWithStoredCreds && !runValidation()) {
      return;
    }
    const credentials = readCredentials();

    if (config.kind === 'marketplace') {
      if (config.mode === 'edit') {
        testMp.mutate(
          { connectionId: config.connection.id },
          {
            onSuccess: (res) => {
              setTestOutcome(res.connected ? 'success' : 'fail');
              if (res.connected) {
                const msg =
                  config.connection.accountLabel ??
                  getMarketplaceDisplay(config.connection.platform).label;
                setTestResult({ ok: true, message: msg });
                toast.success('Bağlantı testi başarılı.');
              } else {
                setTestResult({
                  ok: false,
                  message: 'Kimlik bilgileri doğrulanamadı.',
                });
                toast.warning('Bağlantı testi başarısız.');
              }
            },
            onError: (error) => {
              setTestOutcome('fail');
              const msg = getApiErrorMessage(error);
              const hint = getConnectionErrorHint(msg);
              setTestResult({
                ok: false,
                message: hint ? `${msg} ${hint}` : msg,
              });
              toast.error(msg);
            },
          },
        );
        return;
      }
      testMp.mutate(
        { platform: selectedMarketplaceId, credentials },
        {
          onSuccess: (res) => {
            setTestOutcome(res.connected ? 'success' : 'fail');
            if (res.connected) {
              setTestResult({
                ok: true,
                message: deriveMarketplaceTestMessage(credentials),
              });
              toast.success('Bağlantı testi başarılı.');
            } else {
              setTestResult({
                ok: false,
                message: 'Kimlik bilgileri doğrulanamadı. Alanları kontrol edin.',
              });
              toast.warning('Bağlantı testi başarısız.');
            }
          },
          onError: (error) => {
            setTestOutcome('fail');
            const msg = getApiErrorMessage(error);
            const hint = getConnectionErrorHint(msg);
            setTestResult({
              ok: false,
              message: hint ? `${msg} ${hint}` : msg,
            });
            toast.error(msg);
          },
        },
      );
      return;
    }

    if (config.mode === 'edit') {
      testErp.mutate(
        { connectionId: config.connection.id },
        {
          onSuccess: (res) => {
            setTestOutcome(res.connected ? 'success' : 'fail');
            if (res.connected) {
              const msg =
                res.companyName ??
                config.connection.accountLabel ??
                getErpDisplay(config.connection.erpType).label;
              setTestResult({ ok: true, message: msg });
              toast.success('Bağlantı testi başarılı.');
            } else {
              setTestResult({
                ok: false,
                message: 'ERP bağlantısı doğrulanamadı.',
              });
              toast.warning('Bağlantı testi başarısız.');
            }
          },
          onError: (error) => {
            setTestOutcome('fail');
            const msg = getApiErrorMessage(error);
            const hint = getConnectionErrorHint(msg);
            setTestResult({
              ok: false,
              message: hint ? `${msg} ${hint}` : msg,
            });
            toast.error(msg);
          },
        },
      );
      return;
    }
    testErp.mutate(
      { erpType: selectedErpId, credentials },
      {
        onSuccess: (res) => {
          setTestOutcome(res.connected ? 'success' : 'fail');
          if (res.connected) {
            setTestResult({
              ok: true,
              message: res.companyName ?? getErpDisplay(selectedErpId).label,
            });
            toast.success('Bağlantı testi başarılı.');
          } else {
            setTestResult({
              ok: false,
              message: 'ERP kimlik bilgileri doğrulanamadı.',
            });
            toast.warning('Bağlantı testi başarısız.');
          }
        },
        onError: (error) => {
          setTestOutcome('fail');
          const msg = getApiErrorMessage(error);
          const hint = getConnectionErrorHint(msg);
          setTestResult({
            ok: false,
            message: hint ? `${msg} ${hint}` : msg,
          });
          toast.error(msg);
        },
      },
    );
  };

  const celebrateAndClose = (connectionId?: string): void => {
    void confetti({ particleCount: 100, spread: 60, origin: { y: 0.65 } });
    setSaveSuccess(true);
    setSyncStarting(true);
    if (connectionId) {
      triggerSync.mutate(connectionId, {
        onSettled: () => {
          setTimeout(() => {
            onOpenChange(false);
            setSaveSuccess(false);
            setSyncStarting(false);
          }, 2200);
        },
      });
    } else {
      setTimeout(() => {
        onOpenChange(false);
        setSaveSuccess(false);
        setSyncStarting(false);
      }, 2200);
    }
  };

  const handleSave = (): void => {
    if (!config) {
      return;
    }
    if (config.kind === 'marketplace') {
      if (config.mode === 'create') {
        if (!runValidation()) {
          return;
        }
        const credentials = readCredentials();
        createMp.mutate(
          { platform: selectedMarketplaceId, credentials },
          {
            onSuccess: (conn) => {
              track('connection_added', {
                platform: selectedMarketplaceId,
                type: ECOMMERCE_PLATFORM_SET.has(selectedMarketplaceId)
                  ? 'ecommerce'
                  : 'marketplace',
              });
              toast.success('Bağlantı kaydedildi.');
              celebrateAndClose(conn.id);
            },
            onError: (error) => {
              const msg = getApiErrorMessage(error);
              const hint = getConnectionErrorHint(msg);
              toast.error(hint ? `${msg} — ${hint}` : msg);
            },
          },
        );
        return;
      }
      const patch: Record<string, string> = {};
      for (const [k, v] of Object.entries(readCredentials())) {
        if (v.length > 0) {
          patch[k] = v;
        }
      }
      if (Object.keys(patch).length === 0) {
        toast.error('Güncellemek için en az bir alan girin.');
        return;
      }
      updateMp.mutate(
        { id: config.connection.id, credentials: patch },
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
      return;
    }

    if (config.mode === 'create') {
      if (!runValidation()) {
        return;
      }
      const credentials = readCredentials();
      createErp.mutate(
        { erpType: selectedErpId, credentials },
        {
          onSuccess: () => {
            track('connection_added', {
              platform: selectedErpId,
              type: 'erp',
            });
            toast.success('ERP bağlantısı kaydedildi.');
            void confetti({ particleCount: 100, spread: 60, origin: { y: 0.65 } });
            setSaveSuccess(true);
            setTimeout(() => {
              onOpenChange(false);
              setSaveSuccess(false);
            }, 2200);
          },
          onError: (error) => {
            const msg = getApiErrorMessage(error);
            const hint = getConnectionErrorHint(msg);
            toast.error(hint ? `${msg} — ${hint}` : msg);
          },
        },
      );
      return;
    }
    const patch: Record<string, string> = {};
    for (const [k, v] of Object.entries(readCredentials())) {
      if (v.length > 0) {
        patch[k] = v;
      }
    }
    if (Object.keys(patch).length === 0) {
      toast.error('Güncellemek için en az bir alan girin.');
      return;
    }
    updateErp.mutate(
      { id: config.connection.id, credentials: patch },
      {
        onSuccess: () => {
          toast.success('ERP bağlantısı güncellendi.');
          onOpenChange(false);
        },
        onError: (error) => {
          toast.error(getApiErrorMessage(error));
        },
      },
    );
  };

  const testPending = config?.kind === 'marketplace' ? testMp.isPending : testErp.isPending;
  const savePending =
    config?.kind === 'marketplace'
      ? config.mode === 'create'
        ? createMp.isPending
        : updateMp.isPending
      : config?.kind === 'erp'
        ? config.mode === 'create'
          ? createErp.isPending
          : updateErp.isPending
        : false;

  const isCreateMode = config?.mode === 'create';
  const saveRequiresTest = isCreateMode && testOutcome !== 'success';

  const testBadge =
    testPending ? (
      <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Bağlantı test ediliyor…
      </div>
    ) : testResult ? (
      testResult.ok ? (
        <div className="flex items-start gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{testResult.message}</span>
        </div>
      ) : (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{testResult.message}</span>
        </div>
      )
    ) : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (saveSuccess && !next) {
          return;
        }
        onOpenChange(next);
        if (!next) {
          setTestOutcome('idle');
          setTestResult(null);
          setFieldErrors({});
          setSaveSuccess(false);
          setSyncStarting(false);
        }
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        {saveSuccess ? (
          <div className="flex flex-col items-center gap-4 py-10 text-center">
            <Sparkles className="h-12 w-12 text-sky-400" aria-hidden />
            <h3 className="text-lg font-semibold">Bağlantı kuruldu!</h3>
            <p className="text-sm text-muted-foreground">
              {syncStarting
                ? 'İlk senkronizasyon başlatılıyor…'
                : 'Kayıt tamamlandı.'}
            </p>
            {syncStarting ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : null}
          </div>
        ) : (
          <>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Kimlik bilgileriniz şifrelenerek saklanır; güvenlik nedeniyle kayıtlı gizli alanlar
            düzenlemede boş gösterilir.
          </DialogDescription>
        </DialogHeader>

        {activeDisplay ? (
          <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3">
            <span className="text-3xl" aria-hidden>
              {activeDisplay.logo}
            </span>
            <div>
              <p className="font-semibold text-foreground">{activeDisplay.label}</p>
              <p className="text-xs text-muted-foreground">
                {config?.kind === 'marketplace' ? 'Pazaryeri' : 'ERP'} bağlantısı
              </p>
            </div>
          </div>
        ) : null}

        {config ? (
          <Form {...form}>
            <form
              className="space-y-4 py-2"
              onSubmit={(e) => {
                e.preventDefault();
              }}
            >
              {config.kind === 'marketplace' && config.mode === 'create' ? (
                <div className="space-y-2">
                  <Label htmlFor="conn-platform">Platform</Label>
                  <Select
                    value={selectedMarketplaceId}
                    onValueChange={handleMarketplacePlatformChange}
                  >
                    <SelectTrigger id="conn-platform">
                      <SelectValue placeholder="Platform seçin" />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {marketplaceIds.map((id) => {
                        const d = getMarketplaceDisplay(id);
                        return (
                          <SelectItem key={id} value={id}>
                            {d.logo} {d.label}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              {config.kind === 'marketplace' && config.mode === 'edit' ? (
                <p className="text-sm text-muted-foreground">
                  {getMarketplaceDisplay(config.connection.platform).logo}{' '}
                  {getMarketplaceDisplay(config.connection.platform).label}
                </p>
              ) : null}

              {config.kind === 'erp' && config.mode === 'create' ? (
                <div className="space-y-2">
                  <Label htmlFor="conn-erp">ERP</Label>
                  <Select value={selectedErpId} onValueChange={handleErpTypeChange}>
                    <SelectTrigger id="conn-erp">
                      <SelectValue placeholder="ERP seçin" />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {erpIds.map((id) => {
                        const d = getErpDisplay(id);
                        return (
                          <SelectItem key={id} value={id}>
                            {d.logo} {d.label}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              {config.kind === 'erp' && config.mode === 'edit' ? (
                <p className="text-sm text-muted-foreground">
                  {getErpDisplay(config.connection.erpType).logo}{' '}
                  {getErpDisplay(config.connection.erpType).label}
                </p>
              ) : null}

              {platformMeta?.helpText || platformMeta?.docsUrl ? (
                <details className="group rounded-md border border-sky-100 bg-sky-50 text-sm text-sky-900">
                  <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 font-medium [&::-webkit-details-marker]:hidden">
                    API Anahtarı Nasıl Alınır?
                    <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="space-y-2 border-t border-sky-100 px-3 py-2">
                    {platformMeta.helpText ? <p>{platformMeta.helpText}</p> : null}
                    {platformMeta.docsUrl ? (
                      <a
                        href={platformMeta.docsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block font-medium underline underline-offset-2"
                      >
                        Platform dokümantasyonu →
                      </a>
                    ) : null}
                  </div>
                </details>
              ) : null}

              {activeFieldDefs.map((field) => (
                <FormField
                  key={field.key}
                  control={form.control}
                  name={field.key}
                  render={({ field: rhf }) => (
                    <FormItem>
                      <div className="flex items-center justify-between gap-2">
                        <FormLabel>
                          {field.label}
                          {field.required ? ' *' : ''}
                        </FormLabel>
                        {field.type === 'password' ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-xs"
                            onClick={() => {
                              setVisibleSecrets((prev) => ({
                                ...prev,
                                [field.key]: !prev[field.key],
                              }));
                            }}
                          >
                            {visibleSecrets[field.key] ? (
                              <>
                                <EyeOff className="mr-1 h-3.5 w-3.5" />
                                Gizle
                              </>
                            ) : (
                              <>
                                <Eye className="mr-1 h-3.5 w-3.5" />
                                Göster
                              </>
                            )}
                          </Button>
                        ) : null}
                      </div>
                      <FormControl>
                        <Input
                          {...rhf}
                          id={rhf.name}
                          type={
                            field.type === 'password'
                              ? visibleSecrets[field.key]
                                ? 'text'
                                : 'password'
                              : field.type === 'number'
                                ? 'number'
                                : 'text'
                          }
                          autoComplete="off"
                          placeholder={
                            field.placeholder ??
                            (field.type === 'url'
                              ? 'https:// veya http:// ile başlayın'
                              : undefined)
                          }
                          aria-invalid={Boolean(fieldErrors[field.key])}
                          className={fieldErrors[field.key] ? 'border-destructive' : undefined}
                          onChange={(e) => {
                            rhf.onChange(e);
                            setTestOutcome('idle');
                            setTestResult(null);
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
                      ) : (
                        <FormMessage />
                      )}
                    </FormItem>
                  )}
                />
              ))}

              {activeFieldDefs.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Bu kayıt için form alanı tanımlı değil.
                </p>
              ) : null}

              <div className="flex flex-wrap items-center gap-2 pt-2">{testBadge}</div>
            </form>
          </Form>
        ) : null}

        <DialogFooter className="gap-2 sm:flex-row sm:justify-end">
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
            disabled={testPending || activeFieldDefs.length === 0}
            onClick={() => {
              handleTest();
            }}
          >
            {testPending ? 'Test ediliyor…' : 'Bağlantıyı Test Et'}
          </Button>
          <Button
            type="button"
            disabled={
              savePending ||
              activeFieldDefs.length === 0 ||
              saveRequiresTest
            }
            onClick={() => {
              handleSave();
            }}
          >
            {savePending ? 'Kaydediliyor…' : 'Kaydet'}
          </Button>
        </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
