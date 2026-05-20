import confetti from 'canvas-confetti';
import type { ReactElement } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Loader2,
  Package,
  Sparkles,
  Store,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { SearchableCombobox } from '@/components/SearchableCombobox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/hooks/useAuth';
import type { ErpConnectionDto } from '@/hooks/useErpConnections';
import { track } from '@/lib/analytics';
import { api, getApiErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import { completeOnboarding } from '@/pages/onboarding/onboarding.api';
import { ERP_OPTIONS, MARKETPLACE_OPTIONS } from '@/pages/onboarding/onboarding.options';
import {
  ONBOARDING_MARKETPLACE_IDS,
  PLAN_ANNUAL_PRICES,
  PLAN_DESCRIPTIONS,
  PLAN_LABELS,
  PLAN_TIERS,
  recommendPlan,
  STOCK_MGMT_OPTIONS,
  type StockManagementMethod,
} from '@/pages/onboarding/onboarding-wizard.utils';
import { useAuthStore } from '@/store/auth.store';
import type { MeResponse } from '@/types/auth';
import type { OrganizationDetail } from '@/types/organization';
import type { MarketplaceConnectionDto } from '@/types/connection';
import type { PlanTier } from '@/types/subscription';

const STEP_COUNT = 5;
const STEP_LABELS = [
  'Firma Bilgileri',
  'ERP Seçimi',
  'Pazaryerleri',
  'Paket',
  'Tamamlandı',
] as const;

const QUICK_START_ITEMS: readonly {
  label: string;
  href: string;
}[] = [
  { label: 'İlk ürünü ekle', href: '/products' },
  { label: 'Pazaryeri bağla', href: '/connections' },
  { label: 'ERP kur', href: '/connections/erp/setup' },
  { label: 'Ekip üyesi davet et', href: '/settings?tab=team' },
] as const;

function formatTry(amount: number): string {
  return amount.toLocaleString('tr-TR');
}

export function OnboardingWizardPage(): ReactElement {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: me } = useAuth();
  const setOrg = useAuthStore((s) => s.setOrg);

  const [currentStep, setCurrentStep] = useState(1);
  const [hasErp, setHasErp] = useState(false);
  const [erpType, setErpType] = useState<string | null>(null);
  const [stockMgmt, setStockMgmt] = useState<StockManagementMethod | null>(null);
  const [marketplaces, setMarketplaces] = useState<string[]>([]);
  const [showAllMarketplaces, setShowAllMarketplaces] = useState(false);
  const [mpSearch, setMpSearch] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<PlanTier | null>(null);
  const confettiFired = useRef(false);

  const orgQuery = useQuery({
    queryKey: ['organizations', 'me'],
    queryFn: async (): Promise<OrganizationDetail> => {
      const { data } = await api.get<OrganizationDetail>('/organizations/me');
      return data;
    },
    enabled: Boolean(me),
  });

  useEffect(() => {
    document.title = 'Kurulum — Senkronize';
  }, []);

  useEffect(() => {
    track('onboarding_started');
  }, []);

  const recommendedPlan = useMemo(
    (): PlanTier =>
      recommendPlan({
        marketplaceCount: marketplaces.length,
        hasErp,
      }),
    [marketplaces.length, hasErp],
  );

  useEffect(() => {
    if (selectedPlan === null) {
      setSelectedPlan(recommendedPlan);
    }
  }, [recommendedPlan, selectedPlan]);

  const progressPercent = useMemo(
    () => Math.round((currentStep / STEP_COUNT) * 100),
    [currentStep],
  );

  const featuredMarketplaces = useMemo(
    () =>
      MARKETPLACE_OPTIONS.filter((m) =>
        (ONBOARDING_MARKETPLACE_IDS as readonly string[]).includes(m.id),
      ),
    [],
  );

  const moreMarketplaces = useMemo(() => {
    const featuredSet = new Set(ONBOARDING_MARKETPLACE_IDS as readonly string[]);
    const q = mpSearch.trim().toLowerCase();
    return MARKETPLACE_OPTIONS.filter((m) => {
      if (featuredSet.has(m.id)) {
        return false;
      }
      if (!q) {
        return true;
      }
      return m.label.toLowerCase().includes(q) || m.id.toLowerCase().includes(q);
    });
  }, [mpSearch]);

  const erpComboboxOptions = useMemo(
    () =>
      ERP_OPTIONS.map((e) => ({
        value: e.id,
        label: e.label,
        logo: e.logo,
      })),
    [],
  );

  const planMutation = useMutation({
    mutationFn: async (plan: PlanTier): Promise<void> => {
      const current = me?.organization.plan;
      if (current !== plan) {
        await api.post('/subscriptions/change-plan', { plan });
      }
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error));
    },
  });

  const finishMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      if (!me) {
        return;
      }
      const plan = selectedPlan ?? recommendedPlan;
      await planMutation.mutateAsync(plan);

      await completeOnboarding({ onboardingCompleted: true });

      const fresh = await queryClient.fetchQuery({
        queryKey: ['auth', 'me'],
        queryFn: async (): Promise<MeResponse> => {
          const { data } = await api.get<MeResponse>('/auth/me');
          return data;
        },
      });
      queryClient.setQueryData(['auth', 'me'], fresh);
      setOrg({
        id: fresh.organization.id,
        name: fresh.organization.name,
        slug: fresh.organization.slug,
        type: fresh.organization.type,
        onboardingCompleted: fresh.organization.onboardingCompleted,
        plan: fresh.organization.plan,
      });
    },
    onSuccess: async () => {
      let connectedPlatforms: string[] = [];
      try {
        const [mpRes, erpRes] = await Promise.all([
          api.get<MarketplaceConnectionDto[]>('/marketplace-connections'),
          api.get<ErpConnectionDto[]>('/erp-connections'),
        ]);
        connectedPlatforms = [
          ...new Set([
            ...mpRes.data.map((c) => c.platform),
            ...erpRes.data.map((c) => c.erpType),
          ]),
        ];
      } catch {
        connectedPlatforms = [];
      }
      track('onboarding_completed', {
        connectedPlatforms,
        recommendedPlan,
        selectedPlan: selectedPlan ?? recommendedPlan,
        marketplaces,
        hasErp,
        erpType,
        stockMgmt,
      });
      toast.success('Kurulum tamamlandı.');
      navigate('/dashboard', { replace: true });
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error));
    },
  });

  const selectPlanMutation = useMutation({
    mutationFn: async (plan: PlanTier): Promise<void> => {
      setSelectedPlan(plan);
      const current = me?.organization.plan;
      if (current === plan) {
        toast.success('14 günlük deneme süreniz bu paketle devam ediyor.');
        return;
      }
      await api.post('/subscriptions/change-plan', { plan });
      await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      await queryClient.invalidateQueries({ queryKey: ['subscription'] });
      toast.success(`${PLAN_LABELS[plan]} paketi seçildi. 14 günlük ücretsiz deneme aktif.`);
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error));
    },
  });

  useEffect(() => {
    if (currentStep !== STEP_COUNT || confettiFired.current) {
      return;
    }
    confettiFired.current = true;
    void confetti({
      particleCount: 160,
      spread: 80,
      origin: { y: 0.55 },
      colors: ['#38bdf8', '#fbbf24', '#34d399', '#fb7185', '#a78bfa'],
    });
  }, [currentStep]);

  function toggleMarketplace(id: string): void {
    setMarketplaces((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function canProceed(): boolean {
    switch (currentStep) {
      case 1:
        return Boolean(orgQuery.data?.name?.trim());
      case 2:
        return hasErp ? erpType !== null : stockMgmt !== null;
      case 3:
        return marketplaces.length > 0;
      case 4:
        return selectedPlan !== null;
      case 5:
        return true;
      default:
        return false;
    }
  }

  function goNext(): void {
    if (!canProceed()) {
      return;
    }
    setCurrentStep((s) => Math.min(STEP_COUNT, s + 1));
  }

  function goBack(): void {
    setCurrentStep((s) => Math.max(1, s - 1));
  }

  if (!me) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2
          className="h-8 w-8 animate-spin text-muted-foreground"
          aria-label="Yükleniyor"
        />
      </div>
    );
  }

  const orgName = orgQuery.data?.name ?? me.organization.name;
  const taxNumber = orgQuery.data?.taxNumber ?? null;

  const stepContent = (() => {
    switch (currentStep) {
      case 1:
        return (
          <Card className="border-0 shadow-none md:border md:shadow-sm">
            <CardHeader className="space-y-1 px-0 md:px-6">
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Building2 className="h-7 w-7 text-sky-500" aria-hidden />
                Firma bilgileri
              </CardTitle>
              <CardDescription className="text-base">
                Kayıt sırasında girdiğiniz bilgilerin özeti. Güncellemek için ayarlara
                gidebilirsiniz.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 px-0 md:px-6">
              {orgQuery.isLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Bilgiler yükleniyor…
                </div>
              ) : (
                <dl className="space-y-3 rounded-lg border bg-muted/30 px-4 py-4 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Firma adı</dt>
                    <dd className="font-medium text-foreground">{orgName}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Vergi no</dt>
                    <dd className="font-medium text-foreground">
                      {taxNumber ?? '—'}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-muted-foreground">E-posta</dt>
                    <dd className="flex items-center gap-2 font-medium text-foreground">
                      {me.user.email}
                      <span className="inline-flex items-center gap-1 text-emerald-600">
                        <CheckCircle2 className="h-4 w-4" aria-hidden />
                        <span className="text-xs">Onaylı</span>
                      </span>
                    </dd>
                  </div>
                </dl>
              )}
              <Button variant="link" className="h-auto p-0" asChild>
                <Link to="/settings?tab=organization">
                  Bilgileri Düzenle
                  <ExternalLink className="ml-1 h-3.5 w-3.5" aria-hidden />
                </Link>
              </Button>
            </CardContent>
          </Card>
        );
      case 2:
        return (
          <Card className="border-0 shadow-none md:border md:shadow-sm">
            <CardHeader className="space-y-1 px-0 md:px-6">
              <CardTitle className="text-2xl">ERP kullanıyor musunuz?</CardTitle>
              <CardDescription className="text-base">
                Stok ve fatura akışını otomatikleştirmek için ERP bağlantısı kurabilirsiniz.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 px-0 md:px-6">
              <div className="flex items-center justify-between rounded-lg border px-4 py-3">
                <Label htmlFor="has-erp" className="cursor-pointer font-medium">
                  ERP kullanıyorum
                </Label>
                <Switch
                  id="has-erp"
                  checked={hasErp}
                  onCheckedChange={(checked) => {
                    setHasErp(checked);
                    if (checked) {
                      setStockMgmt(null);
                    } else {
                      setErpType(null);
                    }
                  }}
                />
              </div>
              {hasErp ? (
                <div className="space-y-2">
                  <Label htmlFor="erp-select">ERP sistemi</Label>
                  <SearchableCombobox
                    id="erp-select"
                    options={erpComboboxOptions}
                    value={erpType}
                    onChange={setErpType}
                    placeholder="ERP seçin…"
                    searchPlaceholder="ERP ara…"
                    emptyLabel="ERP bulunamadı."
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Stok / muhasebe nasıl yönetiliyor?</Label>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {STOCK_MGMT_OPTIONS.map((opt) => {
                      const selected = stockMgmt === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          className={cn(
                            'rounded-lg border px-4 py-3 text-left text-sm transition-colors',
                            selected
                              ? 'border-primary bg-primary/5 font-medium'
                              : 'border-border hover:border-primary/40',
                          )}
                          onClick={() => setStockMgmt(opt.id)}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      case 3:
        return (
          <Card className="border-0 shadow-none md:border md:shadow-sm">
            <CardHeader className="space-y-1 px-0 md:px-6">
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Store className="h-7 w-7 text-sky-500" aria-hidden />
                Pazaryeri seçimi
              </CardTitle>
              <CardDescription className="text-base">
                Satış yaptığınız kanalları işaretleyin. Bağlantıları kurulumdan sonra
                ekleyebilirsiniz.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0 md:px-6">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {featuredMarketplaces.map((mp) => {
                  const selected = marketplaces.includes(mp.id);
                  return (
                    <button
                      key={mp.id}
                      type="button"
                      className={cn(
                        'relative flex flex-col items-center gap-2 rounded-lg border p-4 transition-colors',
                        selected
                          ? 'border-primary bg-primary/5 ring-1 ring-primary'
                          : 'border-border hover:border-primary/40',
                      )}
                      onClick={() => toggleMarketplace(mp.id)}
                    >
                      {selected ? (
                        <Check
                          className="absolute right-2 top-2 h-4 w-4 text-primary"
                          aria-hidden
                        />
                      ) : null}
                      <span className="text-3xl" aria-hidden>
                        {mp.logo}
                      </span>
                      <span className="text-center text-sm font-medium">{mp.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-6 space-y-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAllMarketplaces((v) => !v)}
                >
                  {showAllMarketplaces ? 'Daha az göster' : 'Daha fazla platform'}
                </Button>
                {showAllMarketplaces ? (
                  <>
                    <input
                      type="search"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      placeholder="Platform ara…"
                      value={mpSearch}
                      onChange={(e) => setMpSearch(e.target.value)}
                      aria-label="Platform ara"
                    />
                    <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border p-2">
                      {moreMarketplaces.length === 0 ? (
                        <p className="px-2 py-4 text-center text-sm text-muted-foreground">
                          Eşleşen platform yok.
                        </p>
                      ) : (
                        moreMarketplaces.map((mp) => {
                          const selected = marketplaces.includes(mp.id);
                          return (
                            <button
                              key={mp.id}
                              type="button"
                              className={cn(
                                'flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-muted',
                                selected && 'bg-primary/5 font-medium',
                              )}
                              onClick={() => toggleMarketplace(mp.id)}
                            >
                              <span aria-hidden>{mp.logo}</span>
                              {mp.label}
                              {selected ? (
                                <Check className="ml-auto h-4 w-4 text-primary" />
                              ) : null}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </>
                ) : null}
              </div>

              <p className="mt-4 text-sm text-muted-foreground">
                {marketplaces.length} pazaryeri seçildi
              </p>
            </CardContent>
          </Card>
        );
      case 4:
        return (
          <Card className="border-0 shadow-none md:border md:shadow-sm">
            <CardHeader className="space-y-1 px-0 md:px-6">
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Package className="h-7 w-7 text-sky-500" aria-hidden />
                Paket önerisi
              </CardTitle>
              <CardDescription className="text-base">
                Seçimlerinize göre önerilen paket:{' '}
                <span className="font-semibold text-foreground">
                  {PLAN_LABELS[recommendedPlan]}
                </span>
                . Yıllık faturalandırma; 14 günlük ücretsiz deneme dahil.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 px-0 md:px-6">
              <div className="grid gap-4 sm:grid-cols-2">
                {PLAN_TIERS.map((tier) => {
                  const prices = PLAN_ANNUAL_PRICES[tier];
                  const isRecommended = tier === recommendedPlan;
                  const isSelected = (selectedPlan ?? recommendedPlan) === tier;
                  return (
                    <div
                      key={tier}
                      className={cn(
                        'relative flex flex-col rounded-xl border p-5 transition-colors',
                        isSelected
                          ? 'border-sky-400 ring-2 ring-sky-400/30'
                          : 'border-border',
                        isRecommended && 'bg-sky-50/40 dark:bg-sky-950/20',
                      )}
                    >
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        {isRecommended ? (
                          <Badge className="bg-sky-500 text-white hover:bg-sky-500">
                            Önerilen
                          </Badge>
                        ) : null}
                        <Badge variant="secondary">14 günlük ücretsiz deneme</Badge>
                      </div>
                      <h3 className="text-lg font-semibold">{PLAN_LABELS[tier]}</h3>
                      <p className="mt-1 text-2xl font-bold text-foreground">
                        ₺{formatTry(prices.yearly)}
                        <span className="text-sm font-normal text-muted-foreground">
                          {' '}
                          / yıl
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        ~₺{formatTry(prices.monthlyHint)} / ay
                      </p>
                      <p className="mt-3 flex-1 text-sm text-muted-foreground">
                        {PLAN_DESCRIPTIONS[tier]}
                      </p>
                      <Button
                        type="button"
                        className="mt-4 w-full"
                        variant={isSelected ? 'default' : 'outline'}
                        disabled={selectPlanMutation.isPending}
                        onClick={() => selectPlanMutation.mutate(tier)}
                      >
                        {selectPlanMutation.isPending && isSelected
                          ? 'Seçiliyor…'
                          : 'Bu paketi seç'}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      case 5:
        return (
          <Card className="relative overflow-hidden border-0 shadow-none md:border md:shadow-sm">
            <CardHeader className="space-y-2 text-center">
              <CardTitle className="flex items-center justify-center gap-2 text-2xl">
                <Sparkles className="h-7 w-7 text-amber-500" aria-hidden />
                Kurulum tamamlandı!
              </CardTitle>
              <CardDescription className="text-base">
                {orgName} için paneliniz hazır. Aşağıdaki adımlarla hızlıca başlayın.
              </CardDescription>
            </CardHeader>
            <CardContent className="mx-auto flex max-w-md flex-col items-stretch gap-6">
              <ul className="space-y-3 text-sm">
                {QUICK_START_ITEMS.map((item) => (
                  <li key={item.href}>
                    <Link
                      to={item.href}
                      className="flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors hover:border-primary/40 hover:bg-muted/40"
                    >
                      <span
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-muted-foreground/40"
                        aria-hidden
                      />
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="text-center text-sm text-muted-foreground">
                Seçilen paket:{' '}
                <span className="font-semibold text-foreground">
                  {PLAN_LABELS[selectedPlan ?? recommendedPlan]}
                </span>
              </p>
              <Button
                type="button"
                size="lg"
                className="w-full"
                disabled={finishMutation.isPending}
                onClick={() => finishMutation.mutate()}
              >
                {finishMutation.isPending ? 'Kaydediliyor…' : 'Panele Git'}
              </Button>
            </CardContent>
          </Card>
        );
      default:
        return null;
    }
  })();

  return (
    <div className="min-h-screen bg-background px-4 py-8 md:py-12">
      <div className="mx-auto flex max-w-4xl flex-col gap-8">
        <header className="space-y-2 text-center md:text-left">
          <p className="text-sm font-medium text-muted-foreground">İlk kurulum</p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            Hesabınızı birkaç adımda hazırlayın
          </h1>
        </header>

        <div className="space-y-3">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              Adım {currentStep} / {STEP_COUNT} — {STEP_LABELS[currentStep - 1]}
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
              className="h-full rounded-full bg-primary transition-all duration-300 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        <ol className="flex flex-wrap items-center justify-center gap-2 md:justify-start">
          {Array.from({ length: STEP_COUNT }, (_, i) => i + 1).map((step) => {
            const done = currentStep > step;
            const active = currentStep === step;
            return (
              <li key={step} className="flex items-center gap-2">
                <span
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-full border text-sm font-medium',
                    done && 'border-emerald-600 bg-emerald-600 text-white',
                    active && !done && 'border-primary bg-primary text-primary-foreground',
                    !active && !done && 'border-muted-foreground/30 text-muted-foreground',
                  )}
                  title={STEP_LABELS[step - 1]}
                >
                  {done ? <Check className="h-4 w-4" aria-hidden /> : step}
                </span>
                {step < STEP_COUNT ? (
                  <span className="hidden h-px w-4 bg-border sm:block" aria-hidden />
                ) : null}
              </li>
            );
          })}
        </ol>

        <div>{stepContent}</div>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
          {currentStep > 1 && currentStep < STEP_COUNT ? (
            <Button type="button" variant="outline" onClick={goBack}>
              <ChevronLeft className="mr-1 h-4 w-4" aria-hidden />
              Geri
            </Button>
          ) : (
            <span />
          )}
          {currentStep < STEP_COUNT && currentStep !== 5 ? (
            <Button type="button" onClick={goNext} disabled={!canProceed()}>
              İleri
              <ChevronRight className="ml-1 h-4 w-4" aria-hidden />
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
