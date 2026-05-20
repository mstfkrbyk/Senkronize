import type { ReactElement } from 'react';
import { useEffect } from 'react';
import { zodFormResolver } from '@/lib/zod-form-resolver';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { track } from '@/lib/analytics';
import { FORM_MESSAGES } from '@/lib/form-messages';
import type { PricingRule, PricingStrategy } from '@/types/pricing';

import { useCreateRule, useUpdatePricingRule } from './hooks/usePricing';
import { PLATFORM_OPTIONS } from './pricing-utils';

const RULE_TYPE_OPTIONS = [
  { value: 'MARKUP', label: 'Markup (artış)' },
  { value: 'MARKDOWN', label: 'Markdown (indirim)' },
  { value: 'BUYBOX_PCT', label: 'BuyBox %' },
] as const;

const BASE_PRICE_OPTIONS = [
  { value: 'COST', label: 'Maliyet' },
  { value: 'COMPETITOR', label: 'Rakip fiyat' },
  { value: 'MANUAL', label: 'Manuel' },
] as const;

const SCHEDULE_OPTIONS = [
  { value: 'ALWAYS', label: 'Her zaman' },
  { value: 'HOURS', label: 'Belirli saat aralığı' },
  { value: 'CAMPAIGN', label: 'Kampanya dönemi' },
] as const;

type RuleType = (typeof RULE_TYPE_OPTIONS)[number]['value'];
type BasePrice = (typeof BASE_PRICE_OPTIONS)[number]['value'];
type ScheduleMode = (typeof SCHEDULE_OPTIONS)[number]['value'];

function ruleTypeToStrategy(
  ruleType: RuleType,
  basePrice: BasePrice,
): PricingStrategy {
  if (ruleType === 'BUYBOX_PCT') {
    return basePrice === 'COST' ? 'PROFIT_FOCUSED' : 'MATCH_BUYBOX';
  }
  if (ruleType === 'MARKUP') {
    return 'FIXED_MARGIN';
  }
  return 'BEAT_BUYBOX';
}

const formSchema = z
  .object({
    name: z.string().min(2, 'Kural adı en az 2 karakter olmalıdır.'),
    ruleType: z.enum(['MARKUP', 'MARKDOWN', 'BUYBOX_PCT']),
    basePrice: z.enum(['COST', 'COMPETITOR', 'MANUAL']),
    amountType: z.enum(['PCT', 'TRY']),
    amount: z
      .string()
      .min(1, FORM_MESSAGES.required)
      .refine((s) => {
        const n = Number(s.replace(',', '.'));
        return !Number.isNaN(n) && n >= 0;
      }, 'Geçerli bir değer girin.'),
    minPrice: z.string().optional(),
    maxPrice: z.string().optional(),
    platforms: z.array(z.string()).min(1, 'En az bir platform seçin.'),
    scheduleMode: z.enum(['ALWAYS', 'HOURS', 'CAMPAIGN']),
    hoursStart: z.string().optional(),
    hoursEnd: z.string().optional(),
    scheduledStart: z.string().optional(),
    scheduledEnd: z.string().optional(),
    applyToAll: z.boolean(),
    barcodesRaw: z.string().optional(),
    isActive: z.boolean(),
  })
  .superRefine((val, ctx) => {
    if (!val.applyToAll) {
      const lines =
        val.barcodesRaw
          ?.split('\n')
          .map((l) => l.trim())
          .filter(Boolean) ?? [];
      if (lines.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Barkod girin veya tüm ürünlere uygula seçeneğini açın.',
          path: ['barcodesRaw'],
        });
      }
    }
    if (val.scheduleMode === 'HOURS') {
      const start = val.hoursStart?.trim();
      const end = val.hoursEnd?.trim();
      if (!start || !end) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Saat aralığı için başlangıç ve bitiş girin.',
          path: ['hoursStart'],
        });
      }
    }
    if (val.scheduleMode === 'CAMPAIGN') {
      if (!val.scheduledStart?.trim() || !val.scheduledEnd?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Kampanya için başlangıç ve bitiş tarihi girin.',
          path: ['scheduledStart'],
        });
      }
    }
  });

type FormValues = z.infer<typeof formSchema>;

function ruleToFormValues(rule: PricingRule): FormValues {
  const isBuyBox =
    rule.strategy === 'MATCH_BUYBOX' ||
    rule.strategy === 'BEAT_BUYBOX' ||
    rule.strategy === 'AGGRESSIVE_BUYBOX';
  return {
    name: rule.name,
    ruleType: isBuyBox ? 'BUYBOX_PCT' : rule.strategy === 'FIXED_MARGIN' ? 'MARKUP' : 'MARKDOWN',
    basePrice: rule.costPrice != null && rule.costPrice > 0 ? 'COST' : 'COMPETITOR',
    amountType: 'PCT',
    amount: rule.maxDiscountPct,
    minPrice: '',
    maxPrice: rule.maxPrice != null ? String(rule.maxPrice) : '',
    platforms: [rule.platform],
    scheduleMode:
      rule.scheduledStart != null
        ? 'CAMPAIGN'
        : rule.hoursStart != null
          ? 'HOURS'
          : 'ALWAYS',
    hoursStart: rule.hoursStart != null ? String(rule.hoursStart) : '',
    hoursEnd: rule.hoursEnd != null ? String(rule.hoursEnd) : '',
    scheduledStart: rule.scheduledStart?.slice(0, 16) ?? '',
    scheduledEnd: rule.scheduledEnd?.slice(0, 16) ?? '',
    applyToAll: rule.applyToAll,
    barcodesRaw: rule.barcodes.join('\n'),
    isActive: rule.isActive,
  };
}

const defaultValues: FormValues = {
  name: '',
  ruleType: 'BUYBOX_PCT',
  basePrice: 'COMPETITOR',
  amountType: 'PCT',
  amount: '5',
  minPrice: '',
  maxPrice: '',
  platforms: ['TRENDYOL'],
  scheduleMode: 'ALWAYS',
  hoursStart: '22',
  hoursEnd: '8',
  scheduledStart: '',
  scheduledEnd: '',
  applyToAll: true,
  barcodesRaw: '',
  isActive: true,
};

function buildPayload(values: FormValues, platform: string): Record<string, unknown> {
  const strategy = ruleTypeToStrategy(values.ruleType, values.basePrice);
  const amount = Number(values.amount.replace(',', '.'));
  const barcodes = values.applyToAll
    ? []
    : (values.barcodesRaw ?? '')
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);

  const payload: Record<string, unknown> = {
    name: values.platforms.length > 1 ? `${values.name} (${platform})` : values.name,
    platform,
    strategy,
    minMarginPct: values.ruleType === 'MARKUP' ? String(amount) : '5',
    maxDiscountPct: values.ruleType === 'MARKDOWN' ? String(amount) : '15',
    applyToAll: values.applyToAll,
    barcodes,
    isActive: values.isActive,
    targetPosition: 1,
  };

  if (values.basePrice === 'COST' && values.minPrice?.trim()) {
    payload.costPrice = Number(values.minPrice.replace(',', '.'));
  }
  if (values.maxPrice?.trim()) {
    payload.maxPrice = Number(values.maxPrice.replace(',', '.'));
  }
  if (values.scheduleMode === 'HOURS') {
    payload.hoursStart = Number(values.hoursStart);
    payload.hoursEnd = Number(values.hoursEnd);
  }
  if (values.scheduleMode === 'CAMPAIGN') {
    payload.scheduledStart = values.scheduledStart
      ? new Date(values.scheduledStart).toISOString()
      : null;
    payload.scheduledEnd = values.scheduledEnd
      ? new Date(values.scheduledEnd).toISOString()
      : null;
  }

  return payload;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule?: PricingRule | null;
}

export function PriceRuleDialog({ open, onOpenChange, rule }: Props): ReactElement {
  const createMutation = useCreateRule();
  const updateMutation = useUpdatePricingRule();
  const isEdit = rule != null;

  const form = useForm<FormValues>({
    resolver: zodFormResolver(formSchema),
    defaultValues,
  });

  const scheduleMode = form.watch('scheduleMode');
  const applyToAll = form.watch('applyToAll');
  const selectedPlatforms = form.watch('platforms');

  useEffect(() => {
    if (!open) {
      form.reset(defaultValues);
      return;
    }
    if (rule) {
      form.reset(ruleToFormValues(rule));
    } else {
      form.reset(defaultValues);
    }
  }, [open, rule, form]);

  const onSubmit = (values: FormValues): void => {
    if (isEdit && rule) {
      const payload = buildPayload(values, rule.platform);
      updateMutation.mutate(
        { id: rule.id, data: payload as Partial<PricingRule> },
        { onSuccess: () => onOpenChange(false) },
      );
      return;
    }

    const platforms = values.platforms;
    let completed = 0;
    for (const platform of platforms) {
      const payload = buildPayload(values, platform);
      createMutation.mutate(payload as Partial<PricingRule>, {
        onSuccess: () => {
          completed += 1;
          if (completed === platforms.length) {
            track('pricing_rule_created', { strategy: payload.strategy });
            onOpenChange(false);
          }
        },
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Kuralı düzenle' : 'Yeni fiyat kuralı'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kural adı</FormLabel>
                  <FormControl>
                    <Input placeholder="Örn. Trendyol BuyBox" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="ruleType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kural tipi</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {RULE_TYPE_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="basePrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Baz fiyat</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {BASE_PRICE_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="amountType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Birim</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="PCT">%</SelectItem>
                        <SelectItem value="TRY">₺</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Oran / miktar</FormLabel>
                    <FormControl>
                      <Input inputMode="decimal" autoComplete="off" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="minPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Min. fiyat (₺)</FormLabel>
                    <FormControl>
                      <Input inputMode="decimal" placeholder="İsteğe bağlı" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="maxPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max. fiyat (₺)</FormLabel>
                    <FormControl>
                      <Input inputMode="decimal" placeholder="İsteğe bağlı" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="platforms"
              render={() => (
                <FormItem>
                  <FormLabel>Hedef platformlar</FormLabel>
                  <div className="flex flex-wrap gap-3 rounded-lg border p-3">
                    {PLATFORM_OPTIONS.map((p) => {
                      const checked = selectedPlatforms.includes(p.value);
                      return (
                        <label
                          key={p.value}
                          className="flex cursor-pointer items-center gap-2 text-sm"
                        >
                          <Checkbox
                            checked={checked}
                            disabled={isEdit}
                            onCheckedChange={(c) => {
                              const next = c
                                ? [...selectedPlatforms, p.value]
                                : selectedPlatforms.filter((x) => x !== p.value);
                              form.setValue('platforms', next, { shouldValidate: true });
                            }}
                          />
                          {p.label}
                        </label>
                      );
                    })}
                  </div>
                  {isEdit ? (
                    <p className="text-xs text-muted-foreground">
                      Düzenlemede platform değiştirilemez; yeni kural oluşturun.
                    </p>
                  ) : null}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="scheduleMode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Zamanlama</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {SCHEDULE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {scheduleMode === 'HOURS' ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="hoursStart"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Başlangıç saati (0–23)</FormLabel>
                      <FormControl>
                        <Input inputMode="numeric" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="hoursEnd"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bitiş saati (0–23)</FormLabel>
                      <FormControl>
                        <Input inputMode="numeric" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            ) : null}

            {scheduleMode === 'CAMPAIGN' ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="scheduledStart"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Kampanya başlangıç</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="scheduledEnd"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Kampanya bitiş</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            ) : null}

            <FormField
              control={form.control}
              name="applyToAll"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <FormLabel className="text-base">Tüm ürünlere uygula</FormLabel>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            {!applyToAll ? (
              <FormField
                control={form.control}
                name="barcodesRaw"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Barkodlar</FormLabel>
                    <FormControl>
                      <Textarea rows={4} placeholder="Satır satır barkod" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <FormLabel className="text-base">Aktif</FormLabel>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                İptal
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {isEdit ? 'Kaydet' : 'Oluştur'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
