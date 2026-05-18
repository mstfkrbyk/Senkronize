import type { ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
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
  useUpdateMarketplaceConnection,
} from '@/hooks/useConnections';
import {
  useCreateErpConnection,
  useTestErpConnection,
  useUpdateErpConnection,
  type ErpConnectionDto,
} from '@/hooks/useErpConnections';
import { getApiErrorMessage } from '@/lib/api';
import {
  ECOMMERCE_MARKETPLACE_IDS,
  ERP_CONNECTION_FORM_FIELDS,
  ERP_TYPE_IDS,
  MARKETPLACE_CONNECTION_FORM_FIELDS,
  MARKETPLACE_PLATFORM_IDS,
  type ConnectionFormFieldDef,
} from '@/lib/connection-form-fields';
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
  const [visibleSecrets, setVisibleSecrets] = useState<Record<string, boolean>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

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
      setVisibleSecrets({});
    },
    [form],
  );

  useEffect(() => {
    if (!open || !config) {
      return;
    }
    setTestOutcome('idle');
    setFieldErrors({});
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
                toast.success('Bağlantı testi başarılı.');
              } else {
                toast.warning('Bağlantı testi başarısız.');
              }
            },
            onError: (error) => {
              setTestOutcome('fail');
              toast.error(getApiErrorMessage(error));
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
              toast.success('Bağlantı testi başarılı.');
            } else {
              toast.warning('Test başarısız görünüyor; yine de kaydedebilirsiniz.');
            }
          },
          onError: (error) => {
            setTestOutcome('fail');
            toast.error(getApiErrorMessage(error));
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
              toast.success('Bağlantı testi başarılı.');
            } else {
              toast.warning('Bağlantı testi başarısız.');
            }
          },
          onError: (error) => {
            setTestOutcome('fail');
            toast.error(getApiErrorMessage(error));
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
            toast.success('Bağlantı testi başarılı.');
          } else {
            toast.warning('Test başarısız görünüyor; yine de kaydedebilirsiniz.');
          }
        },
        onError: (error) => {
          setTestOutcome('fail');
          toast.error(getApiErrorMessage(error));
        },
      },
    );
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
            onSuccess: () => {
              toast.success('Bağlantı kaydedildi.');
              onOpenChange(false);
            },
            onError: (error) => {
              toast.error(getApiErrorMessage(error));
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
            toast.success('ERP bağlantısı kaydedildi.');
            onOpenChange(false);
          },
          onError: (error) => {
            toast.error(getApiErrorMessage(error));
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

  const testBadge =
    testOutcome === 'idle' ? null : testOutcome === 'success' ? (
      <Badge className="border-green-200 bg-green-50 text-green-900">Test: Başarılı</Badge>
    ) : (
      <Badge variant="destructive" className="bg-red-50 text-red-900">
        Test: Başarısız
      </Badge>
    );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          setTestOutcome('idle');
          setFieldErrors({});
        }
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Kimlik bilgileriniz şifrelenerek saklanır; güvenlik nedeniyle kayıtlı gizli alanlar
            düzenlemede boş gösterilir.
          </DialogDescription>
        </DialogHeader>

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
            disabled={savePending || activeFieldDefs.length === 0}
            onClick={() => {
              handleSave();
            }}
          >
            {savePending ? 'Kaydediliyor…' : 'Kaydet'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
