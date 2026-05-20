import type { ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodFormResolver } from '@/lib/zod-form-resolver';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { track } from '@/lib/analytics';
import { api, getApiErrorMessage } from '@/lib/api';
import { FORM_MESSAGES } from '@/lib/form-messages';
import { TURKEY_PROVINCES } from '@/lib/turkey-provinces';
import { useAuthStore } from '@/store/auth.store';
import type { MeResponse, TokenPair } from '@/types/auth';
import type { PlanTier } from '@/types/subscription';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
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
import { cn } from '@/lib/utils';
import { useValidatePartnerInvite } from '@/pages/partner/hooks/usePartner';

const STEP_COUNT = 4;

const PHONE_DIGITS = z
  .string()
  .min(1, FORM_MESSAGES.required)
  .regex(/^5[0-9]{9}$/, 'Geçerli bir cep numarası girin (10 hane, 5 ile başlar, başında 0 yok).');

const ERP_CHOICES: { id: string; label: string }[] = [
  { id: 'BIZIMHESAP', label: 'BizimHesap' },
  { id: 'PARASUT', label: 'Paraşüt' },
  { id: 'LOGO', label: 'Logo Tiger' },
  { id: 'MIKRO', label: 'Mikro' },
  { id: 'NETSIS', label: 'Netsis' },
  { id: 'LUCA', label: 'Luca' },
  { id: 'DIGER_ERP', label: 'Diğer' },
];

const MARKETPLACE_CHOICES: { id: string; label: string }[] = [
  { id: 'TRENDYOL', label: 'Trendyol' },
  { id: 'HEPSIBURADA', label: 'Hepsiburada' },
  { id: 'N11', label: 'N11' },
  { id: 'CICEKSEPETI', label: 'Çiçeksepeti' },
  { id: 'AMAZON_TR', label: 'Amazon TR' },
  { id: 'PTTAVM', label: 'PTT AVM' },
  { id: 'PAZARAMA', label: 'Pazarama' },
  { id: 'EBAY', label: 'eBay' },
  { id: 'ETSY', label: 'Etsy' },
  { id: 'DIGER_MP', label: 'Diğer' },
];

const ECOMMERCE_CHOICES: { id: string; label: string }[] = [
  { id: 'TSOFT', label: 'T-Soft' },
  { id: 'TICIMAX', label: 'Ticimax' },
  { id: 'WOOCOMMERCE', label: 'WooCommerce' },
  { id: 'SHOPIFY', label: 'Shopify' },
  { id: 'IDEASOFT', label: 'İdeasoft' },
  { id: 'SHOPIVERSE', label: 'Shopiverse' },
  { id: 'DIGER_EC', label: 'Diğer' },
];

const ANNUAL_PLANS: Array<{
  id: PlanTier;
  name: string;
  priceYear: number;
}> = [
  { id: 'BASLANGIC', name: 'Başlangıç', priceYear: 2900 },
  { id: 'GELISIM', name: 'Gelişim', priceYear: 5900 },
  { id: 'PRO', name: 'Pro', priceYear: 9900 },
  { id: 'KURUMSAL', name: 'Kurumsal', priceYear: 19_900 },
];

function formatTry(amount: number): string {
  return amount.toLocaleString('tr-TR');
}

function monthlyEquivalent(yearly: number): number {
  return Math.round(yearly / 12);
}

const registerFormSchema = z
  .object({
    name: z.string().min(1, FORM_MESSAGES.required).max(100),
    email: z.string().min(1, FORM_MESSAGES.required).email(FORM_MESSAGES.email),
    phoneDigits: PHONE_DIGITS,
    password: z.string().min(8, 'Şifre en az 8 karakter olmalıdır.'),
    confirmPassword: z.string().min(1, FORM_MESSAGES.required),
    companyName: z.string().min(1, FORM_MESSAGES.required).max(200),
    taxNumber: z
      .string()
      .min(1, FORM_MESSAGES.required)
      .regex(/^\d{10}$/, 'Vergi numarası 10 haneli olmalıdır'),
    taxOffice: z.string().min(1, FORM_MESSAGES.required).max(200),
    address: z.string().min(1, FORM_MESSAGES.required).max(500),
    city: z.string().min(1, FORM_MESSAGES.required).max(100),
    website: z.string().max(200).optional().or(z.literal('')),
    referralCode: z.string().max(50).optional().or(z.literal('')),
    acceptTos: z.boolean().refine((v) => v === true, {
      message: 'Kullanım şartlarını kabul etmelisiniz.',
    }),
    selectedPlan: z.enum(['BASLANGIC', 'GELISIM', 'PRO', 'KURUMSAL']),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Şifreler eşleşmiyor.',
    path: ['confirmPassword'],
  });

type RegisterFormValues = z.infer<typeof registerFormSchema>;

const STEP1_FIELDS: (keyof RegisterFormValues)[] = [
  'name',
  'email',
  'phoneDigits',
  'password',
  'confirmPassword',
];
const STEP2_FIELDS: (keyof RegisterFormValues)[] = [
  'companyName',
  'taxNumber',
  'taxOffice',
  'address',
  'city',
  'website',
  'referralCode',
];

interface RecommendPlanResponse {
  recommendedPlan: PlanTier;
  reason: string;
}

export function RegisterPage(): ReactElement {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const token = useAuthStore((s) => s.token);
  const setTokens = useAuthStore((s) => s.setTokens);
  const setUser = useAuthStore((s) => s.setUser);
  const setOrg = useAuthStore((s) => s.setOrg);

  const [step, setStep] = useState(1);
  const [usesErp, setUsesErp] = useState(false);
  const [erpSelection, setErpSelection] = useState<string[]>([]);
  const [marketplaceSelection, setMarketplaceSelection] = useState<string[]>([]);
  const [hasEcommerceSite, setHasEcommerceSite] = useState(false);
  const [ecommerceSelection, setEcommerceSelection] = useState<string[]>([]);

  const form = useForm<RegisterFormValues>({
    resolver: zodFormResolver(registerFormSchema),
    defaultValues: {
      name: '',
      email: '',
      phoneDigits: '',
      password: '',
      confirmPassword: '',
      companyName: '',
      taxNumber: '',
      taxOffice: '',
      address: '',
      city: '',
      website: '',
      referralCode: '',
      acceptTos: false,
      selectedPlan: 'GELISIM',
    },
  });

  const inviteFromUrl = searchParams.get('invite');
  const inviteValidation = useValidatePartnerInvite(inviteFromUrl);

  useEffect(() => {
    if (inviteValidation.data?.partnerOrgId) {
      form.setValue('referralCode', inviteValidation.data.partnerOrgId);
    }
  }, [inviteValidation.data?.partnerOrgId, form]);

  useEffect(() => {
    if (inviteValidation.data?.email) {
      form.setValue('email', inviteValidation.data.email);
    }
  }, [inviteValidation.data?.email, form]);

  const erpCount = usesErp ? Math.max(1, erpSelection.length) : 0;
  const marketplaceCount = marketplaceSelection.length;
  const ecommerceCount = hasEcommerceSite ? Math.max(1, ecommerceSelection.length) : 0;

  const recommendQuery = useQuery({
    queryKey: ['auth', 'recommend-plan', erpCount, marketplaceCount, ecommerceCount],
    queryFn: async (): Promise<RecommendPlanResponse> => {
      const { data } = await api.post<RecommendPlanResponse>('/auth/recommend-plan', {
        erpCount,
        marketplaceCount,
        ecommerceCount,
      });
      return data;
    },
    enabled: step === 4,
  });

  const recommendSynced = useRef(false);

  useEffect(() => {
    if (step !== 4) {
      recommendSynced.current = false;
    }
  }, [step]);

  useEffect(() => {
    if (
      step === 4 &&
      recommendQuery.isSuccess &&
      recommendQuery.data &&
      !recommendSynced.current
    ) {
      form.setValue('selectedPlan', recommendQuery.data.recommendedPlan);
      recommendSynced.current = true;
    }
  }, [step, recommendQuery.isSuccess, recommendQuery.data, form]);

  const registerMutation = useMutation({
    mutationFn: async (values: RegisterFormValues): Promise<void> => {
      const phone = `+90${values.phoneDigits}`;
      const { data: tokens } = await api.post<TokenPair>('/auth/register', {
        name: values.name,
        email: values.email,
        password: values.password,
        phone,
        companyName: values.companyName,
        taxNumber: values.taxNumber,
        taxOffice: values.taxOffice,
        address: values.address,
        city: values.city,
        website: values.website?.trim() || undefined,
        referralCode: values.referralCode?.trim() || undefined,
        inviteToken: inviteFromUrl ?? undefined,
        plan: values.selectedPlan,
      });
      setTokens(tokens.accessToken, tokens.refreshToken, tokens.sessionId);
      const { data: me } = await api.get<MeResponse>('/auth/me');
      queryClient.setQueryData(['auth', 'me'], me);
      setUser({
        id: me.user.id,
        email: me.user.email,
        name: me.user.name,
        role: me.user.role,
      });
      setOrg({
        id: me.organization.id,
        name: me.organization.name,
        slug: me.organization.slug,
        type: me.organization.type,
        onboardingCompleted: me.organization.onboardingCompleted,
        plan: me.organization.plan,
      });
    },
    onSuccess: (_, values) => {
      track('user_registered', {
        plan: values.selectedPlan,
        marketplaceCount: marketplaceSelection.length,
        erpCount,
        referralCodePresent: Boolean(values.referralCode?.trim()),
      });
      toast.success('Kayıt tamamlandı, hoş geldiniz.');
      const legacyInviteToken = searchParams.get('inviteToken');
      if (legacyInviteToken) {
        navigate(`/invite/${encodeURIComponent(legacyInviteToken)}`, { replace: true });
        return;
      }
      navigate('/dashboard', { replace: true });
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error));
    },
  });

  useEffect(() => {
    document.title = 'Kayıt — Senkronize';
  }, []);

  const progressPercent = useMemo(
    () => Math.round((step / STEP_COUNT) * 100),
    [step],
  );

  const goNext = useCallback(async (): Promise<void> => {
    const fields =
      step === 1 ? STEP1_FIELDS : step === 2 ? STEP2_FIELDS : ([] as (keyof RegisterFormValues)[]);
    if (fields.length > 0) {
      const ok = await form.trigger(fields);
      if (!ok) {
        return;
      }
    }
    if (step === 3) {
      if (usesErp && erpSelection.length === 0) {
        toast.error('En az bir ERP seçin veya ERP kullanmıyorum seçeneğini işaretleyin.');
        return;
      }
      if (marketplaceSelection.length === 0) {
        toast.error('En az bir pazaryeri seçin.');
        return;
      }
      if (hasEcommerceSite && ecommerceSelection.length === 0) {
        toast.error('E-ticaret altyapısı seçin veya “E-ticaret sitem yok” seçeneğini işaretleyin.');
        return;
      }
    }
    setStep((s) => Math.min(STEP_COUNT, s + 1));
  }, [step, form, usesErp, erpSelection.length, marketplaceSelection.length, hasEcommerceSite, ecommerceSelection.length]);

  const goBack = useCallback((): void => {
    setStep((s) => Math.max(1, s - 1));
  }, []);

  const onFinalSubmit = useCallback(
    (values: RegisterFormValues): void => {
      if (inviteFromUrl) {
        if (
          inviteValidation.isLoading ||
          inviteValidation.isError ||
          !inviteValidation.data
        ) {
          toast.error('Davet kodu geçerli değil veya doğrulanamadı.');
          return;
        }
      }
      registerMutation.mutate(values);
    },
    [
      registerMutation,
      inviteFromUrl,
      inviteValidation.isLoading,
      inviteValidation.isError,
      inviteValidation.data,
    ],
  );

  if (token) {
    const legacyInviteToken = searchParams.get('inviteToken');
    if (legacyInviteToken) {
      return (
        <Navigate
          to={`/invite/${encodeURIComponent(legacyInviteToken)}`}
          replace
        />
      );
    }
    return <Navigate to="/dashboard" replace />;
  }

  function toggleInList(list: string[], id: string, setList: (v: string[]) => void): void {
    if (list.includes(id)) {
      setList(list.filter((x) => x !== id));
    } else {
      setList([...list, id]);
    }
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Hesap oluştur</CardTitle>
        <CardDescription>
          14 günlük ücretsiz denemenizi başlatın. Kredi kartı gerekmez; ödeme daha sonra.
        </CardDescription>
        {inviteFromUrl ? (
          <div className="rounded-md border border-sky-400/50 bg-sky-50 p-3 text-sm text-sky-950 dark:bg-sky-950/30 dark:text-sky-50">
            {inviteValidation.isLoading ? (
              <p>Davet doğrulanıyor…</p>
            ) : null}
            {inviteValidation.isError ? (
              <p className="text-destructive">
                Davet doğrulanamadı: {getApiErrorMessage(inviteValidation.error)}
              </p>
            ) : null}
            {inviteValidation.data ? (
              <p>
                <span className="font-medium">{inviteValidation.data.partnerName}</span> davetiyle
                kayıt oluyorsunuz. Referans kodu otomatik uygulandı.
              </p>
            ) : null}
          </div>
        ) : null}
        <div className="space-y-2 pt-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              Adım {step} / {STEP_COUNT}
            </span>
            <span>{progressPercent}%</span>
          </div>
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </CardHeader>
      <Form {...form}>
        <form
          onSubmit={
            step === 4
              ? form.handleSubmit(onFinalSubmit)
              : (e) => {
                  e.preventDefault();
                }
          }
        >
          <CardContent className="space-y-6">
            {step === 1 ? (
              <>
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ad Soyad</FormLabel>
                      <FormControl>
                        <Input autoComplete="name" placeholder="Adınız Soyadınız" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>E-posta</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          autoComplete="email"
                          placeholder="ornek@sirket.com"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phoneDigits"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefon</FormLabel>
                      <FormControl>
                        <div className="flex rounded-md border border-input shadow-sm focus-within:ring-1 focus-within:ring-ring">
                          <span className="flex items-center rounded-l-md border-r bg-muted px-3 text-sm text-muted-foreground">
                            +90
                          </span>
                          <Input
                            className="rounded-l-none border-0 shadow-none focus-visible:ring-0"
                            inputMode="numeric"
                            autoComplete="tel"
                            placeholder="5XXXXXXXXX"
                            maxLength={10}
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <p className="text-xs text-muted-foreground">
                        Başında 0 olmadan 10 hane (ör. 5XXXXXXXXX).
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Şifre</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          autoComplete="new-password"
                          placeholder="En az 8 karakter"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Şifre tekrar</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          autoComplete="new-password"
                          placeholder="Şifrenizi tekrar girin"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            ) : null}

            {step === 2 ? (
              <>
                <FormField
                  control={form.control}
                  name="companyName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Firma adı</FormLabel>
                      <FormControl>
                        <Input placeholder="Ticari unvan" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="taxNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vergi numarası</FormLabel>
                      <FormControl>
                        <Input inputMode="numeric" maxLength={10} placeholder="10 hane" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="taxOffice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vergi dairesi</FormLabel>
                      <FormControl>
                        <Input placeholder="Bağlı olduğunuz vergi dairesi" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Adres</FormLabel>
                      <FormControl>
                        <Input placeholder="Açık adres" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Şehir</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="İl seçin" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="max-h-60">
                          {TURKEY_PROVINCES.map((p) => (
                            <SelectItem key={p} value={p}>
                              {p}
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
                  name="website"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Web sitesi (isteğe bağlı)</FormLabel>
                      <FormControl>
                        <Input placeholder="https://..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="referralCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Referans kodu (isteğe bağlı)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Partner referans kodunuz varsa girin"
                          readOnly={Boolean(inviteFromUrl && inviteValidation.data)}
                          className={cn(
                            inviteFromUrl && inviteValidation.data
                              ? 'cursor-not-allowed bg-muted'
                              : undefined,
                          )}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            ) : null}

            {step === 3 ? (
              <div className="space-y-8">
                <div className="space-y-3">
                  <Label>ERP kullanıyor musunuz?</Label>
                  <div className="flex flex-wrap gap-3" role="radiogroup" aria-label="ERP kullanımı">
                    <Button
                      type="button"
                      variant={usesErp ? 'default' : 'outline'}
                      onClick={() => {
                        setUsesErp(true);
                      }}
                    >
                      Evet
                    </Button>
                    <Button
                      type="button"
                      variant={!usesErp ? 'default' : 'outline'}
                      onClick={() => {
                        setUsesErp(false);
                        setErpSelection([]);
                      }}
                    >
                      Hayır
                    </Button>
                  </div>
                  {usesErp ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {ERP_CHOICES.map((opt) => (
                        <label
                          key={opt.id}
                          className="flex cursor-pointer items-center gap-2 rounded-md border p-3 text-sm"
                        >
                          <Checkbox
                            checked={erpSelection.includes(opt.id)}
                            onCheckedChange={() =>
                              toggleInList(erpSelection, opt.id, setErpSelection)
                            }
                          />
                          {opt.label}
                        </label>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="space-y-3">
                  <Label>Hangi pazaryerlerinde satış yapıyorsunuz?</Label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {MARKETPLACE_CHOICES.map((opt) => (
                      <label
                        key={opt.id}
                        className="flex cursor-pointer items-center gap-2 rounded-md border p-3 text-sm"
                      >
                        <Checkbox
                          checked={marketplaceSelection.includes(opt.id)}
                          onCheckedChange={() =>
                            toggleInList(marketplaceSelection, opt.id, setMarketplaceSelection)
                          }
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>E-ticaret siteniz var mı?</Label>
                  <div className="flex flex-wrap gap-3" role="radiogroup" aria-label="E-ticaret sitesi">
                    <Button
                      type="button"
                      variant={hasEcommerceSite ? 'default' : 'outline'}
                      onClick={() => setHasEcommerceSite(true)}
                    >
                      Evet
                    </Button>
                    <Button
                      type="button"
                      variant={!hasEcommerceSite ? 'default' : 'outline'}
                      onClick={() => {
                        setHasEcommerceSite(false);
                        setEcommerceSelection([]);
                      }}
                    >
                      Hayır
                    </Button>
                  </div>
                  {hasEcommerceSite ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {ECOMMERCE_CHOICES.map((opt) => (
                        <label
                          key={opt.id}
                          className="flex cursor-pointer items-center gap-2 rounded-md border p-3 text-sm"
                        >
                          <Checkbox
                            checked={ecommerceSelection.includes(opt.id)}
                            onCheckedChange={() =>
                              toggleInList(ecommerceSelection, opt.id, setEcommerceSelection)
                            }
                          />
                          {opt.label}
                        </label>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {step === 4 ? (
              <div className="space-y-6">
                {recommendQuery.isLoading ? (
                  <p className="text-sm text-muted-foreground">Paket önerisi hesaplanıyor…</p>
                ) : null}
                {recommendQuery.isError ? (
                  <p className="text-sm text-destructive">
                    {getApiErrorMessage(recommendQuery.error)}
                  </p>
                ) : null}
                {recommendQuery.isSuccess ? (
                  <div className="rounded-lg border border-sky-400/40 bg-sky-50 p-4 text-sm text-sky-950 dark:bg-sky-950/30 dark:text-sky-100">
                    <p className="font-medium">Önerilen paket</p>
                    <p className="mt-1">
                      {ANNUAL_PLANS.find((p) => p.id === recommendQuery.data.recommendedPlan)?.name ??
                        recommendQuery.data.recommendedPlan}
                    </p>
                    <p className="mt-2 text-muted-foreground">{recommendQuery.data.reason}</p>
                  </div>
                ) : null}

                <FormField
                  control={form.control}
                  name="selectedPlan"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Paket seçimi</FormLabel>
                      <FormControl>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {ANNUAL_PLANS.map((plan) => {
                            const recommended = recommendQuery.data?.recommendedPlan === plan.id;
                            return (
                              <button
                                key={plan.id}
                                type="button"
                                onClick={() => field.onChange(plan.id)}
                                className={cn(
                                  'rounded-lg border p-4 text-left text-sm transition-colors',
                                  field.value === plan.id
                                    ? 'border-primary ring-2 ring-primary/30'
                                    : 'border-border hover:border-primary/50',
                                  recommended && 'bg-sky-50/80 dark:bg-sky-950/20',
                                )}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-semibold">{plan.name}</span>
                                  {recommended ? (
                                    <span className="rounded-full bg-sky-400 px-2 py-0.5 text-xs text-slate-900">
                                      Önerilen
                                    </span>
                                  ) : null}
                                </div>
                                <p className="mt-2 text-2xl font-bold text-primary">
                                  ₺{formatTry(plan.priceYear)}
                                  <span className="text-sm font-normal text-muted-foreground"> /yıl</span>
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  Aylık {formatTry(monthlyEquivalent(plan.priceYear))} ₺&apos;ye
                                  eşdeğer
                                </p>
                              </button>
                            );
                          })}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="acceptTos"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={(v) => field.onChange(v === true)}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="font-normal">
                          Senkronize kullanım şartlarını ve gizlilik politikasını okudum, kabul
                          ediyorum.
                        </FormLabel>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />
              </div>
            ) : null}
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <div className="flex w-full flex-col-reverse gap-3 sm:flex-row sm:justify-between">
              {step > 1 ? (
                <Button type="button" variant="outline" onClick={goBack}>
                  Geri
                </Button>
              ) : (
                <span />
              )}
              {step < 4 ? (
                <Button type="button" className="sm:ml-auto" onClick={() => void goNext()}>
                  İleri
                </Button>
              ) : (
                <Button
                  type="submit"
                  className="sm:ml-auto"
                  disabled={registerMutation.isPending || recommendQuery.isLoading}
                >
                  {registerMutation.isPending
                    ? 'Kaydediliyor…'
                    : '14 Günlük Ücretsiz Deneme Başlat'}
                </Button>
              )}
            </div>
            <p className="text-center text-sm text-muted-foreground">
              Zaten hesabınız var mı?{' '}
              <Link
                to="/login"
                className="font-medium text-accent underline-offset-4 hover:underline"
              >
                Giriş yapın
              </Link>
            </p>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
