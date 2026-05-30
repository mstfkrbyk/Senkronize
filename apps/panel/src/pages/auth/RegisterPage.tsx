import type { ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { zodFormResolver } from '@/lib/zod-form-resolver';
import { useForm } from 'react-hook-form';
import { AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';

import { track } from '@/lib/analytics';
import { api, getApiErrorMessage } from '@/lib/api';
import { FORM_MESSAGES } from '@/lib/form-messages';
import { TURKEY_PROVINCES } from '@/lib/turkey-provinces';
import { useAuthStore } from '@/store/auth.store';
import type { AccountingMode, MeResponse, TokenPair } from '@/types/auth';
import type { PlanTier } from '@/types/subscription';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { PasswordInput } from '@/components/ui/password-input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AccountingModeCards } from '@/components/AccountingModeCards';
import { ProductSelectionCards } from '@/components/ProductSelectionCards';
import {
  readStoredProductSelection,
  writeStoredProductSelection,
  type ProductSelection,
} from '@/lib/product-selection';
import { resolveAppHomePath } from '@/lib/app-home';
import { cn } from '@/lib/utils';
import { useValidatePartnerInvite } from '@/pages/partner/hooks/usePartner';
import {
  formatRegisterNavContext,
  formatRegisterStepLabel,
} from '@/pages/auth/register-nav-context';

const STEP_COUNT = 5;

function buildPhoneDigitsSchema(t: TFunction) {
  return z
    .string()
    .min(1, FORM_MESSAGES.required)
    .regex(/^5[0-9]{9}$/, t('register.validation.phoneDigits'));
}

function buildErpChoices(t: TFunction): { id: string; label: string }[] {
  return [
    { id: 'BIZIMHESAP', label: 'BizimHesap' },
    { id: 'PARASUT', label: 'Paraşüt' },
    { id: 'LOGO', label: 'Logo Tiger' },
    { id: 'MIKRO', label: 'Mikro' },
    { id: 'NETSIS', label: 'Netsis' },
    { id: 'LUCA', label: 'Luca' },
    { id: 'DIGER_ERP', label: t('register.choices.other') },
  ];
}

function buildMarketplaceChoices(t: TFunction): { id: string; label: string }[] {
  return [
    { id: 'TRENDYOL', label: 'Trendyol' },
    { id: 'HEPSIBURADA', label: 'Hepsiburada' },
    { id: 'N11', label: 'N11' },
    { id: 'CICEKSEPETI', label: 'Çiçeksepeti' },
    { id: 'AMAZON_TR', label: 'Amazon TR' },
    { id: 'PTTAVM', label: 'PTT AVM' },
    { id: 'PAZARAMA', label: 'Pazarama' },
    { id: 'EBAY', label: 'eBay' },
    { id: 'ETSY', label: 'Etsy' },
    { id: 'DIGER_MP', label: t('register.choices.other') },
  ];
}

function buildEcommerceChoices(t: TFunction): { id: string; label: string }[] {
  return [
    { id: 'TSOFT', label: 'T-Soft' },
    { id: 'TICIMAX', label: 'Ticimax' },
    { id: 'WOOCOMMERCE', label: 'WooCommerce' },
    { id: 'SHOPIFY', label: 'Shopify' },
    { id: 'IDEASOFT', label: 'İdeasoft' },
    { id: 'SHOPIVERSE', label: 'Shopiverse' },
    { id: 'DIGER_EC', label: t('register.choices.other') },
  ];
}

function buildAnnualPlans(t: TFunction): Array<{
  id: PlanTier;
  name: string;
  priceYear: number;
}> {
  return [
    { id: 'BASLANGIC', name: t('payment.plans.BASLANGIC'), priceYear: 2900 },
    { id: 'GELISIM', name: t('payment.plans.GELISIM'), priceYear: 5900 },
    { id: 'PRO', name: t('payment.plans.PRO'), priceYear: 9900 },
    { id: 'KURUMSAL', name: t('payment.plans.KURUMSAL'), priceYear: 19_900 },
  ];
}

function createRegisterFormSchema(t: TFunction) {
  return z
    .object({
      name: z.string().min(1, FORM_MESSAGES.required).max(100),
      email: z.string().min(1, FORM_MESSAGES.required).email(FORM_MESSAGES.email),
      phoneDigits: buildPhoneDigitsSchema(t),
      password: z.string().min(8, t('register.validation.passwordMin')),
      confirmPassword: z.string().min(1, FORM_MESSAGES.required),
      companyName: z.string().min(1, FORM_MESSAGES.required).max(200),
      taxNumber: z
        .string()
        .min(1, FORM_MESSAGES.required)
        .regex(/^\d{10}$/, t('register.validation.taxNumber')),
      taxOffice: z.string().min(1, FORM_MESSAGES.required).max(200),
      address: z.string().min(1, FORM_MESSAGES.required).max(500),
      city: z.string().min(1, FORM_MESSAGES.required).max(100),
      website: z.string().max(200).optional().or(z.literal('')),
      referralCode: z.string().max(50).optional().or(z.literal('')),
      acceptTos: z.boolean().refine((v) => v === true, {
        message: t('register.validation.acceptTos'),
      }),
      selectedPlan: z.enum(['BASLANGIC', 'GELISIM', 'PRO', 'KURUMSAL']),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t('register.validation.passwordMismatch'),
      path: ['confirmPassword'],
    });
}

type RegisterFormValues = z.infer<ReturnType<typeof createRegisterFormSchema>>;

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

function formatTry(amount: number): string {
  return amount.toLocaleString('tr-TR');
}

function monthlyEquivalent(yearly: number): number {
  return Math.round(yearly / 12);
}

function resolveRegisterAccountingModePayload(
  productSelection: ProductSelection | null,
  accountingModeChoice: AccountingMode | null,
): { accountingMode?: AccountingMode } {
  if (productSelection === 'ACCOUNTING') {
    return { accountingMode: accountingModeChoice ?? 'NATIVE' };
  }
  if (productSelection === 'BUNDLE' && accountingModeChoice) {
    return { accountingMode: accountingModeChoice };
  }
  return {};
}

export function RegisterPage(): ReactElement {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const token = useAuthStore((s) => s.token);
  const setTokens = useAuthStore((s) => s.setTokens);
  const setUser = useAuthStore((s) => s.setUser);
  const setOrg = useAuthStore((s) => s.setOrg);

  const registerFormSchema = useMemo(() => createRegisterFormSchema(t), [t]);
  const erpChoices = useMemo(() => buildErpChoices(t), [t]);
  const marketplaceChoices = useMemo(() => buildMarketplaceChoices(t), [t]);
  const ecommerceChoices = useMemo(() => buildEcommerceChoices(t), [t]);
  const annualPlans = useMemo(() => buildAnnualPlans(t), [t]);

  const [step, setStep] = useState(1);
  const [productSelection, setProductSelection] = useState<ProductSelection | null>(
    () => readStoredProductSelection(),
  );
  const [accountingModeChoice, setAccountingModeChoice] = useState<AccountingMode | null>(
    null,
  );
  const [usesErp, setUsesErp] = useState(false);
  const [erpSelection, setErpSelection] = useState<string[]>([]);
  const [marketplaceSelection, setMarketplaceSelection] = useState<string[]>([]);
  const [hasEcommerceSite, setHasEcommerceSite] = useState(false);
  const [ecommerceSelection, setEcommerceSelection] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

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
    enabled: step === 5,
  });

  const recommendSynced = useRef(false);

  useEffect(() => {
    if (step !== 5) {
      recommendSynced.current = false;
    }
  }, [step]);

  useEffect(() => {
    if (
      step === 5 &&
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
        productSelection: productSelection ?? undefined,
        ...resolveRegisterAccountingModePayload(productSelection, accountingModeChoice),
      });
      if (productSelection) {
        writeStoredProductSelection(productSelection);
      }
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
        orgProducts: me.organization.orgProducts,
        accountingMode: me.organization.accountingMode,
      });
    },
    onSuccess: (_, values) => {
      track('user_registered', {
        plan: values.selectedPlan,
        productSelection: productSelection ?? undefined,
        marketplaceCount: marketplaceSelection.length,
        erpCount,
        referralCodePresent: Boolean(values.referralCode?.trim()),
      });
      toast.success(t('register.toast.success'));
      const legacyInviteToken = searchParams.get('inviteToken');
      if (legacyInviteToken) {
        navigate(`/invite/${encodeURIComponent(legacyInviteToken)}`, { replace: true });
        return;
      }
      const org = useAuthStore.getState().currentOrg;
      navigate(
        resolveAppHomePath({
          type: org?.type,
          orgProducts: org?.orgProducts,
          isImpersonating: false,
          accountingMode: org?.accountingMode,
        }),
        { replace: true },
      );
    },
    onMutate: () => {
      setFormError(null);
    },
    onError: (error: unknown) => {
      setFormError(getApiErrorMessage(error));
    },
  });

  const partnerInviteFlow = Boolean(inviteFromUrl);
  const navContextLine = formatRegisterNavContext(step, t, {
    partnerInvite: partnerInviteFlow,
  });
  const stepLabel = formatRegisterStepLabel(step, t);
  const pageLabel = t('register.nav.pageLabel');

  useEffect(() => {
    document.title = t('register.documentTitle', { stepLabel, pageLabel });
  }, [stepLabel, pageLabel, t]);

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
      if (!productSelection) {
        toast.error(t('register.toast.productRequired'));
        return;
      }
      if (productSelection === 'BUNDLE' && !accountingModeChoice) {
        toast.error(t('register.toast.accountingModeRequired'));
        return;
      }
      writeStoredProductSelection(productSelection);
    }
    if (step === 4) {
      if (usesErp && erpSelection.length === 0) {
        toast.error(t('register.toast.erpRequired'));
        return;
      }
      if (marketplaceSelection.length === 0) {
        toast.error(t('register.toast.marketplaceRequired'));
        return;
      }
      if (hasEcommerceSite && ecommerceSelection.length === 0) {
        toast.error(t('register.toast.ecommerceRequired'));
        return;
      }
    }
    setStep((s) => Math.min(STEP_COUNT, s + 1));
  }, [
    step,
    form,
    productSelection,
    accountingModeChoice,
    usesErp,
    erpSelection.length,
    marketplaceSelection.length,
    hasEcommerceSite,
    ecommerceSelection.length,
    t,
  ]);

  const goBack = useCallback((): void => {
    setStep((s) => Math.max(1, s - 1));
  }, []);

  const onFinalSubmit = useCallback(
    (values: RegisterFormValues): void => {
      if (!productSelection) {
        toast.error(t('register.toast.productMissing'));
        return;
      }
      if (productSelection === 'BUNDLE' && !accountingModeChoice) {
        toast.error(t('register.toast.accountingModeRequired'));
        return;
      }
      if (inviteFromUrl) {
        if (
          inviteValidation.isLoading ||
          inviteValidation.isError ||
          !inviteValidation.data
        ) {
          toast.error(t('register.toast.inviteInvalid'));
          return;
        }
      }
      registerMutation.mutate(values);
    },
    [
      registerMutation,
      productSelection,
      accountingModeChoice,
      inviteFromUrl,
      inviteValidation.isLoading,
      inviteValidation.isError,
      inviteValidation.data,
      t,
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
    <Card className="mx-auto w-full max-w-2xl">
      <CardHeader>
        <p className="text-sm text-muted-foreground">{navContextLine}</p>
        <CardTitle>{t('register.title')}</CardTitle>
        <CardDescription>{t('register.description')}</CardDescription>
        {inviteFromUrl ? (
          <div className="rounded-md border border-sky-400/50 bg-sky-50 p-3 text-sm text-sky-950 dark:bg-sky-950/30 dark:text-sky-50">
            {inviteValidation.isLoading ? (
              <p>{t('register.partnerInvite.verifying')}</p>
            ) : null}
            {inviteValidation.isError ? (
              <p className="text-destructive">
                {t('register.partnerInvite.errorPrefix')}{' '}
                {getApiErrorMessage(inviteValidation.error)}
              </p>
            ) : null}
            {inviteValidation.data ? (
              <p>
                <span className="font-medium">{inviteValidation.data.partnerName}</span>{' '}
                {t('register.partnerInvite.registeringSuffix')}
              </p>
            ) : null}
          </div>
        ) : null}
        <div className="space-y-2 pt-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              {t('register.progress.stepOf', { current: step, total: STEP_COUNT })}
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
            step === 5
              ? form.handleSubmit(onFinalSubmit)
              : (e) => {
                  e.preventDefault();
                }
          }
        >
          <CardContent className="space-y-6">
            {formError ? (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            ) : null}
            {step === 1 ? (
              <>
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('register.step1.nameLabel')}</FormLabel>
                      <FormControl>
                        <Input
                          autoComplete="name"
                          autoFocus
                          placeholder={t('register.step1.namePlaceholder')}
                          className="text-base"
                          {...field}
                          onChange={(e) => {
                            setFormError(null);
                            field.onChange(e);
                          }}
                        />
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
                      <FormLabel>{t('register.step1.emailLabel')}</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          autoComplete="email"
                          placeholder={t('register.step1.emailPlaceholder')}
                          readOnly={Boolean(inviteFromUrl && inviteValidation.data)}
                          className={cn(
                            'text-base',
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
                <FormField
                  control={form.control}
                  name="phoneDigits"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('register.step1.phoneLabel')}</FormLabel>
                      <FormControl>
                        <div className="flex rounded-md border border-input shadow-sm focus-within:ring-1 focus-within:ring-ring">
                          <span className="flex items-center rounded-l-md border-r bg-muted px-3 text-sm text-muted-foreground">
                            +90
                          </span>
                          <Input
                            className="rounded-l-none border-0 text-base shadow-none focus-visible:ring-0"
                            inputMode="numeric"
                            autoComplete="tel"
                            placeholder="5XXXXXXXXX"
                            maxLength={10}
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <p className="text-xs text-muted-foreground">
                        {t('register.step1.phoneHint')}
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
                      <FormLabel>{t('register.step1.passwordLabel')}</FormLabel>
                      <FormControl>
                        <PasswordInput
                          autoComplete="new-password"
                          placeholder={t('register.step1.passwordPlaceholder')}
                          className="text-base"
                          {...field}
                          onChange={(e) => {
                            setFormError(null);
                            field.onChange(e);
                          }}
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
                      <FormLabel>{t('register.step1.confirmPasswordLabel')}</FormLabel>
                      <FormControl>
                        <PasswordInput
                          autoComplete="new-password"
                          placeholder={t('register.step1.confirmPasswordPlaceholder')}
                          className="text-base"
                          {...field}
                          onChange={(e) => {
                            setFormError(null);
                            field.onChange(e);
                          }}
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
                      <FormLabel>{t('register.step2.companyNameLabel')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('register.step2.companyNamePlaceholder')} className="text-base" {...field} />
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
                      <FormLabel>{t('register.step2.taxNumberLabel')}</FormLabel>
                      <FormControl>
                        <Input inputMode="numeric" maxLength={10} placeholder={t('register.step2.taxNumberPlaceholder')} className="text-base" {...field} />
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
                      <FormLabel>{t('register.step2.taxOfficeLabel')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('register.step2.taxOfficePlaceholder')} className="text-base" {...field} />
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
                      <FormLabel>{t('register.step2.addressLabel')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('register.step2.addressPlaceholder')} className="text-base" {...field} />
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
                      <FormLabel>{t('register.step2.cityLabel')}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('register.step2.cityPlaceholder')} />
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
                      <FormLabel>{t('register.step2.websiteLabel')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('register.step2.websitePlaceholder')} className="text-base" {...field} />
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
                      <FormLabel>{t('register.step2.referralCodeLabel')}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t('register.step2.referralCodePlaceholder')}
                          readOnly={Boolean(inviteFromUrl && inviteValidation.data)}
                          className={cn(
                            'text-base',
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
              <div className="space-y-4">
                <div>
                  <Label className="text-base">{t('register.step3.productLineLabel')}</Label>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t('register.step3.productLineHint')}
                  </p>
                </div>
                <ProductSelectionCards
                  value={productSelection}
                  onChange={(id) => {
                    setProductSelection(id);
                    writeStoredProductSelection(id);
                    if (id !== 'BUNDLE' && id !== 'ACCOUNTING') {
                      setAccountingModeChoice(null);
                    }
                  }}
                />
                {productSelection === 'BUNDLE' || productSelection === 'ACCOUNTING' ? (
                  <div className="space-y-3 border-t pt-6">
                    <div>
                      <Label className="text-base">{t('register.step3.accountingModeLabel')}</Label>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {productSelection === 'BUNDLE'
                          ? t('register.step3.accountingModeBundleHint')
                          : t('register.step3.accountingModeAccountingHint')}
                      </p>
                    </div>
                    <AccountingModeCards
                      value={accountingModeChoice}
                      onChange={setAccountingModeChoice}
                    />
                  </div>
                ) : null}
              </div>
            ) : null}

            {step === 4 ? (
              <div className="space-y-8">
                <div className="space-y-3">
                  <Label>{t('register.step4.erpQuestion')}</Label>
                  <div className="flex flex-wrap gap-3" role="radiogroup" aria-label={t('register.step4.erpAriaLabel')}>
                    <Button
                      type="button"
                      variant={usesErp ? 'default' : 'outline'}
                      onClick={() => {
                        setUsesErp(true);
                      }}
                    >
                      {t('common.yes')}
                    </Button>
                    <Button
                      type="button"
                      variant={!usesErp ? 'default' : 'outline'}
                      onClick={() => {
                        setUsesErp(false);
                        setErpSelection([]);
                      }}
                    >
                      {t('common.no')}
                    </Button>
                  </div>
                  {usesErp ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {erpChoices.map((opt) => (
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
                  <Label>{t('register.step4.marketplaceQuestion')}</Label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {marketplaceChoices.map((opt) => (
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
                  <Label>{t('register.step4.ecommerceQuestion')}</Label>
                  <div className="flex flex-wrap gap-3" role="radiogroup" aria-label={t('register.step4.ecommerceAriaLabel')}>
                    <Button
                      type="button"
                      variant={hasEcommerceSite ? 'default' : 'outline'}
                      onClick={() => setHasEcommerceSite(true)}
                    >
                      {t('common.yes')}
                    </Button>
                    <Button
                      type="button"
                      variant={!hasEcommerceSite ? 'default' : 'outline'}
                      onClick={() => {
                        setHasEcommerceSite(false);
                        setEcommerceSelection([]);
                      }}
                    >
                      {t('common.no')}
                    </Button>
                  </div>
                  {hasEcommerceSite ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {ecommerceChoices.map((opt) => (
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

            {step === 5 ? (
              <div className="space-y-6">
                {recommendQuery.isLoading ? (
                  <p className="text-sm text-muted-foreground">{t('register.step5.recommendLoading')}</p>
                ) : null}
                {recommendQuery.isError ? (
                  <p className="text-sm text-destructive">
                    {getApiErrorMessage(recommendQuery.error)}
                  </p>
                ) : null}
                {recommendQuery.isSuccess ? (
                  <div className="rounded-lg border border-sky-400/40 bg-sky-50 p-4 text-sm text-sky-950 dark:bg-sky-950/30 dark:text-sky-100">
                    <p className="font-medium">{t('register.step5.recommendedTitle')}</p>
                    <p className="mt-1">
                      {annualPlans.find((p) => p.id === recommendQuery.data.recommendedPlan)?.name ??
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
                      <FormLabel>{t('register.step5.planSelectionLabel')}</FormLabel>
                      <FormControl>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {annualPlans.map((plan) => {
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
                                      {t('register.step5.recommendedBadge')}
                                    </span>
                                  ) : null}
                                </div>
                                <p className="mt-2 text-2xl font-bold text-primary">
                                  ₺{formatTry(plan.priceYear)}
                                  <span className="text-sm font-normal text-muted-foreground">
                                    {' '}
                                    {t('register.step5.pricePerYear')}
                                  </span>
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {t('register.step5.monthlyEquivalent', {
                                    amount: formatTry(monthlyEquivalent(plan.priceYear)),
                                  })}
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
                          {t('register.step5.tosLabel')}
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
                  {t('common.back')}
                </Button>
              ) : (
                <span />
              )}
              {step < 5 ? (
                <Button type="button" className="sm:ml-auto" onClick={() => void goNext()}>
                  {t('common.next')}
                </Button>
              ) : (
                <Button
                  type="submit"
                  className="sm:ml-auto"
                  disabled={registerMutation.isPending || recommendQuery.isLoading}
                >
                  {registerMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                      {t('register.step5.submitPending')}
                    </>
                  ) : (
                    t('register.step5.submit')
                  )}
                </Button>
              )}
            </div>
            <p className="text-center text-sm text-muted-foreground">
              {t('register.footer.hasAccount')}{' '}
              <Link
                to={
                  inviteFromUrl
                    ? `/login?invite=${encodeURIComponent(inviteFromUrl)}`
                    : '/login'
                }
                className="font-medium text-accent underline-offset-4 hover:underline"
              >
                {t('register.footer.signIn')}
              </Link>
            </p>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
