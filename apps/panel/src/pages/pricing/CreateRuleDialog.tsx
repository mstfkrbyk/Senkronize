import type { ReactElement } from 'react';
import { useEffect } from 'react';
import { zodFormResolver } from '@/lib/zod-form-resolver';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
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

import { useCreateRule } from './hooks/usePricing';

const STRATEGY_LABELS: Record<PricingStrategy, string> = {
  MATCH_BUYBOX: "BuyBox'a eşitle",
  BEAT_BUYBOX: "BuyBox'tan ucuz",
  FIXED_MARGIN: 'Sabit marj',
  DYNAMIC: 'Dinamik (AI)',
  AGGRESSIVE_BUYBOX: 'Agresif BuyBox',
  PROFIT_FOCUSED: 'Kâr odaklı',
  TIME_BASED: 'Zaman bazlı',
  STOCK_BASED: 'Stok bazlı',
};

const formSchema = z
  .object({
    name: z
      .string()
      .min(1, FORM_MESSAGES.required)
      .min(2, 'Kural adı en az 2 karakter olmalıdır.'),
    platform: z.enum(['TRENDYOL', 'HEPSIBURADA']),
    strategy: z.enum([
      'MATCH_BUYBOX',
      'BEAT_BUYBOX',
      'FIXED_MARGIN',
      'DYNAMIC',
      'AGGRESSIVE_BUYBOX',
      'PROFIT_FOCUSED',
      'TIME_BASED',
      'STOCK_BASED',
    ]),
    minMarginPct: z
      .string()
      .min(1, FORM_MESSAGES.required)
      .refine((s) => {
        const n = Number(s);
        return !Number.isNaN(n) && n >= 0 && n <= 100;
      }, '0–100 arası girin.'),
    maxDiscountPct: z
      .string()
      .min(1, FORM_MESSAGES.required)
      .refine((s) => {
        const n = Number(s);
        return !Number.isNaN(n) && n >= 0 && n <= 100;
      }, '0–100 arası girin.'),
    costPrice: z
      .string()
      .optional()
      .refine((s) => {
        if (s === undefined || s.trim() === '') {
          return true;
        }
        const n = Number(s.replace(',', '.'));
        if (Number.isNaN(n)) {
          return false;
        }
        if (n <= 0) {
          return false;
        }
        return true;
      }, FORM_MESSAGES.pricePositive),
    applyToAll: z.boolean(),
    barcodesRaw: z.string().optional(),
    categoryFilter: z.string().optional(),
    brandFilter: z.string().optional(),
    skuPattern: z.string().optional(),
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
  });

type FormValues = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateRuleDialog({ open, onOpenChange }: Props): ReactElement {
  const createMutation = useCreateRule();

  const form = useForm<FormValues>({
    resolver: zodFormResolver(formSchema),
    defaultValues: {
      name: '',
      platform: 'TRENDYOL',
      strategy: 'MATCH_BUYBOX',
      minMarginPct: '5',
      maxDiscountPct: '15',
      costPrice: '',
      applyToAll: true,
      barcodesRaw: '',
      categoryFilter: '',
      brandFilter: '',
      skuPattern: '',
    },
  });

  const applyToAll = form.watch('applyToAll');

  useEffect(() => {
    if (!open) {
      form.reset({
        name: '',
        platform: 'TRENDYOL',
        strategy: 'MATCH_BUYBOX',
        minMarginPct: '5',
        maxDiscountPct: '15',
        costPrice: '',
        applyToAll: true,
        barcodesRaw: '',
        categoryFilter: '',
        brandFilter: '',
        skuPattern: '',
      });
    }
  }, [open, form]);

  const onSubmit = (values: FormValues): void => {
    const barcodes =
      values.applyToAll
        ? []
        : (values.barcodesRaw ?? '')
            .split('\n')
            .map((l) => l.trim())
            .filter(Boolean);

    const payload: Record<string, unknown> = {
      name: values.name,
      platform: values.platform,
      strategy: values.strategy,
      minMarginPct: String(Number(values.minMarginPct)),
      maxDiscountPct: String(Number(values.maxDiscountPct)),
      applyToAll: values.applyToAll,
      barcodes,
      isActive: true,
      targetPosition: 1,
    };
    const costRaw = values.costPrice?.trim();
    if (costRaw) {
      payload.costPrice = Number(costRaw.replace(',', '.'));
    }
    const cat = values.categoryFilter?.trim();
    const brand = values.brandFilter?.trim();
    const sku = values.skuPattern?.trim();
    if (cat) {
      payload.categoryFilter = cat;
    }
    if (brand) {
      payload.brandFilter = brand;
    }
    if (sku) {
      payload.skuPattern = sku;
    }

    createMutation.mutate(
      payload as Partial<PricingRule>,
      {
        onSuccess: () => {
          track('pricing_rule_created', { strategy: values.strategy });
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Yeni fiyat kuralı</DialogTitle>
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
                    <Input placeholder="Örn. Trendyol agresif" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="platform"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Platform</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seçin" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="TRENDYOL">Trendyol</SelectItem>
                      <SelectItem value="HEPSIBURADA">Hepsiburada</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="strategy"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Strateji</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seçin" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(Object.keys(STRATEGY_LABELS) as PricingStrategy[]).map((key) => (
                        <SelectItem key={key} value={key}>
                          {STRATEGY_LABELS[key]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="minMarginPct"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Min. kar marjı (%)</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="maxDiscountPct"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max. indirim (%)</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="costPrice"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Maliyet fiyatı (TRY, isteğe bağlı)</FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      placeholder="Örn. 120,50"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="applyToAll"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Tüm ürünlere uygula</FormLabel>
                  </div>
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
                    <FormLabel>Barkodlar (satır satır)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={'8680000000001\n8680000000002'}
                        rows={5}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}

            <div className="space-y-2 rounded-lg border p-3">
              <p className="text-sm font-medium">Kategori / marka / SKU (isteğe bağlı)</p>
              <FormField
                control={form.control}
                name="categoryFilter"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kategori içerir</FormLabel>
                    <FormControl>
                      <Input placeholder="Örn. Ayakkabı" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="brandFilter"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Marka içerir</FormLabel>
                    <FormControl>
                      <Input placeholder="Örn. Nike" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="skuPattern"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SKU deseni (regex)</FormLabel>
                    <FormControl>
                      <Input placeholder="Örn. ^ABC" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                İptal
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                Oluştur
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
