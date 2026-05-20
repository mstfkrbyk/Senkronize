import confetti from 'canvas-confetti';
import type { ReactElement } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Package,
  Sparkles,
  Store,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import type { ErpConnectionDto } from '@/hooks/useErpConnections';
import { track } from '@/lib/analytics';
import { api, getApiErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import { completeOnboarding } from '@/pages/onboarding/onboarding.api';
import { ERP_OPTIONS, MARKETPLACE_OPTIONS } from '@/pages/onboarding/onboarding.options';
import {
  ONBOARDING_ERP_IDS,
  ONBOARDING_MARKETPLACE_IDS,
  PLAN_DESCRIPTIONS,
  PLAN_LABELS,
  recommendPlan,
  SECTOR_OPTIONS,
  type BusinessSector,
} from '@/pages/onboarding/onboarding-wizard.utils';
import { useAuthStore } from '@/store/auth.store';
import type { MeResponse } from '@/types/auth';
import type { MarketplaceConnectionDto } from '@/types/connection';
import type { PlanTier } from '@/types/subscription';

const STEP_COUNT = 5;
const STEP_LABELS = [
  'Hoş geldin',
  'ERP',
  'Pazaryerleri',
  'Paket',
  'Hazırsın',
] as const;

export function OnboardingWizardPage(): ReactElement {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: me } = useAuth();
  const setOrg = useAuthStore((s) => s.setOrg);

  const [currentStep, setCurrentStep] = useState(1);
  const [companyName, setCompanyName] = useState('');
  const [sector, setSector] = useState<BusinessSector | null>(null);
  const [hasErp, setHasErp] = useState<boolean | null>(null);
  const [erpType, setErpType] = useState<string | null>(null);
  const [marketplaces, setMarketplaces] = useState<string[]>([]);
  const confettiFired = useRef(false);

  useEffect(() => {
    document.title = 'Kurulum — Senkronize';
  }, []);

  useEffect(() => {
    track('onboarding_started');
  }, []);

  useEffect(() => {
    if (me?.organization.name && companyName.length === 0) {
      setCompanyName(me.organization.name);
    }
  }, [me?.organization.name, companyName.length]);

  const recommendedPlan = useMemo(
    (): PlanTier =>
      recommendPlan({
        marketplaceCount: marketplaces.length,
        hasErp: hasErp === true,
      }),
    [marketplaces.length, hasErp],
  );

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

  const featuredErps = useMemo(
    () => ERP_OPTIONS.filter((e) => (ONBOARDING_ERP_IDS as readonly string[]).includes(e.id)),
    [],
  );

  const finishMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      if (!me) {
        return;
      }
      const trimmedName = companyName.trim();
      await completeOnboarding({
        onboardingCompleted: true,
        ...(trimmedName.length > 0 && trimmedName !== me.organization.name
          ? { name: trimmedName }
          : {}),
      });
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
        sector,
        marketplaces,
        hasErp,
      });
      toast.success('Kurulum tamamlandı.');
      navigate('/dashboard', { replace: true });
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
        return companyName.trim().length >= 2 && sector !== null;
      case 2:
        return hasErp !== null && (hasErp === false || erpType !== null);
      case 3:
        return marketplaces.length > 0;
      case 4:
        return true;
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

  const stepContent = (() => {
    switch (currentStep) {
      case 1:
        return (
          <Card className="border-0 shadow-none md:border md:shadow-sm">
            <CardHeader className="space-y-1 px-0 md:px-6">
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Building2 className="h-7 w-7 text-sky-500" aria-hidden />
                Hoş geldiniz
              </CardTitle>
              <CardDescription className="text-base">
                Firmanızı tanıyalım; size uygun kurulum ve paket önerisi hazırlayalım.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 px-0 md:px-6">
              <div className="space-y-2">
                <Label htmlFor="company-name">Firma adı</Label>
                <Input
                  id="company-name"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Örn. Acme Tekstil A.Ş."
                  autoComplete="organization"
                />
              </div>
              <div className="space-y-2">
                <Label>Sektör</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {SECTOR_OPTIONS.map((opt) => {
                    const selected = sector === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        className={cn(
                          'rounded-lg border px-4 py-3 text-left text-sm transition-colors',
                          selected
                            ? 'border-primary bg-primary/5 font-medium text-foreground'
                            : 'border-border hover:border-primary/40',
                        )}
                        onClick={() => setSector(opt.id)}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Logo yükleme yakında eklenecek.
              </p>
            </CardContent>
          </Card>
        );
      case 2:
        return (
          <Card className="border-0 shadow-none md:border md:shadow-sm">
            <CardHeader className="space-y-1 px-0 md:px-6">
              <CardTitle className="text-2xl">ERP veya muhasebe kullanıyor musunuz?</CardTitle>
              <CardDescription className="text-base">
                Stok ve fatura akışını otomatikleştirmek için ERP bağlantısı kurabilirsiniz.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 px-0 md:px-6">
              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  variant={hasErp === true ? 'default' : 'outline'}
                  onClick={() => setHasErp(true)}
                >
                  Evet
                </Button>
                <Button
                  type="button"
                  variant={hasErp === false ? 'default' : 'outline'}
                  onClick={() => {
                    setHasErp(false);
                    setErpType(null);
                  }}
                >
                  Hayır
                </Button>
              </div>
              {hasErp === true ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {featuredErps.map((erp) => {
                    const selected = erpType === erp.id;
                    return (
                      <button
                        key={erp.id}
                        type="button"
                        className={cn(
                          'flex items-center gap-3 rounded-lg border p-4 text-left transition-colors',
                          selected
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/40',
                        )}
                        onClick={() => setErpType(erp.id)}
                      >
                        <span className="text-2xl" aria-hidden>
                          {erp.logo}
                        </span>
                        <span className="font-medium">{erp.label}</span>
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </CardContent>
          </Card>
        );
      case 3:
        return (
          <Card className="border-0 shadow-none md:border md:shadow-sm">
            <CardHeader className="space-y-1 px-0 md:px-6">
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Store className="h-7 w-7 text-sky-500" aria-hidden />
                Hangi pazaryerlerinde satış yapıyorsunuz?
              </CardTitle>
              <CardDescription className="text-base">
                Birden fazla seçebilirsiniz. Bağlantıları kurulumdan sonra ekleyebilirsiniz.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0 md:px-6">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
                Size önerilen paket
              </CardTitle>
              <CardDescription className="text-base">
                Seçimlerinize göre otomatik hesaplandı. Aboneliğinizi ayarlardan
                değiştirebilirsiniz.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 px-0 md:px-6">
              <div className="rounded-xl border-2 border-sky-400/60 bg-sky-50/50 p-6 dark:bg-sky-950/20">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-sky-500 text-white hover:bg-sky-500">
                    Önerilen
                  </Badge>
                  <span className="text-2xl font-semibold text-foreground">
                    {PLAN_LABELS[recommendedPlan]}
                  </span>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  {PLAN_DESCRIPTIONS[recommendedPlan]}
                </p>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <span className="font-medium text-foreground">Sektör: </span>
                  {SECTOR_OPTIONS.find((s) => s.id === sector)?.label ?? '—'}
                </li>
                <li>
                  <span className="font-medium text-foreground">Pazaryeri: </span>
                  {marketplaces.length} kanal
                </li>
                <li>
                  <span className="font-medium text-foreground">ERP: </span>
                  {hasErp && erpType
                    ? (ERP_OPTIONS.find((e) => e.id === erpType)?.label ?? erpType)
                    : 'Yok / sonra'}
                </li>
              </ul>
            </CardContent>
          </Card>
        );
      case 5:
        return (
          <Card className="relative overflow-hidden border-0 shadow-none md:border md:shadow-sm">
            <CardHeader className="space-y-2 text-center">
              <CardTitle className="flex items-center justify-center gap-2 text-2xl">
                <Sparkles className="h-7 w-7 text-amber-500" aria-hidden />
                Hazırsınız!
              </CardTitle>
              <CardDescription className="text-base">
                {companyName.trim()} için paneliniz hazır. Bağlantılarınızı ekleyerek
                senkronizasyonu başlatabilirsiniz.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4 text-center">
              <p className="text-sm text-muted-foreground">
                Önerilen paket:{' '}
                <span className="font-semibold text-foreground">
                  {PLAN_LABELS[recommendedPlan]}
                </span>
              </p>
              <Button
                type="button"
                size="lg"
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
      <div className="mx-auto flex max-w-3xl flex-col gap-8">
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
          {currentStep > 1 ? (
            <Button type="button" variant="outline" onClick={goBack}>
              <ChevronLeft className="mr-1 h-4 w-4" aria-hidden />
              Geri
            </Button>
          ) : (
            <span />
          )}
          {currentStep < STEP_COUNT ? (
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
