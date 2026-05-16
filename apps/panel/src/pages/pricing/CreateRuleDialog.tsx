import type { ReactElement } from 'react';
import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
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
import type { PricingStrategy } from '@/types/pricing';

import { useCreateRule } from './hooks/usePricing';

const STRATEGY_LABELS: Record<PricingStrategy, string> = {
  MATCH_BUYBOX: "BuyBox'a eşitle",
  BEAT_BUYBOX: "BuyBox'tan ucuz",
  FIXED_MARGIN: 'Sabit marj',
  DYNAMIC: 'Dinamik (AI)',
};

const formSchema = z
  .object({
    name: z.string().min(2, 'Kural adı en az 2 karakter olmalıdır.'),
    platform: z.enum(['TRENDYOL', 'HEPSIBURADA']),
    strategy: z.enum([
      'MATCH_BUYBOX',
      'BEAT_BUYBOX',
      'FIXED_MARGIN',
      'DYNAMIC',
    ]),
    minMarginPct: z
      .string()
      .min(1, 'Min. marj gerekli.')
      .refine((s) => {
        const n = Number(s);
        return !Number.isNaN(n) && n >= 0 && n <= 100;
      }, '0–100 arası girin.'),
    maxDiscountPct: z
      .string()
      .min(1, 'Max. indirim gerekli.')
      .refine((s) => {
        const n = Number(s);
        return !Number.isNaN(n) && n >= 0 && n <= 100;
      }, '0–100 arası girin.'),
    applyToAll: z.boolean(),
    barcodesRaw: z.string().optional(),
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
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      platform: 'TRENDYOL',
      strategy: 'MATCH_BUYBOX',
      minMarginPct: '5',
      maxDiscountPct: '15',
      applyToAll: true,
      barcodesRaw: '',
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
        applyToAll: true,
        barcodesRaw: '',
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

    createMutation.mutate(
      {
        name: values.name,
        platform: values.platform,
        strategy: values.strategy,
        minMarginPct: String(Number(values.minMarginPct)),
        maxDiscountPct: String(Number(values.maxDiscountPct)),
        applyToAll: values.applyToAll,
        barcodes,
        isActive: true,
        targetPosition: 1,
      },
      {
        onSuccess: () => {
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
