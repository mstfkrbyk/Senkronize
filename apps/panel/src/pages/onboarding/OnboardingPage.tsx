import type { ReactElement } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronLeft, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import type { ErpConnectionDto } from '@/hooks/useErpConnections';
import { track } from '@/lib/analytics';
import { api, getApiErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import { completeOnboarding } from '@/pages/onboarding/onboarding.api';
import { Step1Welcome } from '@/pages/onboarding/steps/Step1Welcome';
import { Step2Connections } from '@/pages/onboarding/steps/Step2Connections';
import { Step3Ready } from '@/pages/onboarding/steps/Step3Ready';
import { useAuthStore } from '@/store/auth.store';
import type { MeResponse } from '@/types/auth';
import type { MarketplaceConnectionDto } from '@/types/connection';

const STEP_COUNT = 3;

export function OnboardingPage(): ReactElement {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: me } = useAuth();
  const setOrg = useAuthStore((s) => s.setOrg);

  const [currentStep, setCurrentStep] = useState(1);

  useEffect(() => {
    document.title = 'Kurulum — Senkronize';
  }, []);

  useEffect(() => {
    track('onboarding_started');
  }, []);

  const progressPercent = useMemo(
    () => Math.round((currentStep / STEP_COUNT) * 100),
    [currentStep],
  );

  const finishMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      if (!me) {
        return;
      }
      await completeOnboarding({
        onboardingCompleted: true,
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
      track('onboarding_completed', { connectedPlatforms });
      toast.success('Kurulum tamamlandı.');
      navigate('/dashboard', { replace: true });
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error));
    },
  });

  if (!me) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-label="Yükleniyor" />
      </div>
    );
  }

  function goNext(): void {
    setCurrentStep((s) => Math.min(STEP_COUNT, s + 1));
  }

  function goBack(): void {
    setCurrentStep((s) => Math.max(1, s - 1));
  }

  const stepContent = (() => {
    switch (currentStep) {
      case 1:
        return (
          <Step1Welcome organizationName={me.organization.name} onNext={goNext} />
        );
      case 2:
        return <Step2Connections onNext={goNext} />;
      case 3:
        return (
          <Step3Ready
            organizationName={me.organization.name}
            isSubmitting={finishMutation.isPending}
            onGoDashboard={() => finishMutation.mutate()}
          />
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
              Adım {currentStep} / {STEP_COUNT}
            </span>
            <span>{progressPercent}%</span>
          </div>
          <svg
            className="h-2 w-full overflow-hidden rounded-full"
            viewBox="0 0 100 2"
            preserveAspectRatio="none"
            role="progressbar"
            aria-valuenow={progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <title>İlerleme</title>
            <rect x="0" y="0" width="100" height="2" className="fill-muted" rx="1" />
            <rect
              x="0"
              y="0"
              width={progressPercent}
              height="2"
              className="fill-primary transition-all duration-300 ease-out"
              rx="1"
            />
          </svg>
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
                >
                  {done ? <Check className="h-4 w-4" aria-hidden /> : step}
                </span>
                {step < STEP_COUNT ? (
                  <span className="hidden h-px w-6 bg-border sm:block" aria-hidden />
                ) : null}
              </li>
            );
          })}
        </ol>

        <div>{stepContent}</div>

        {currentStep > 1 && currentStep < 3 ? (
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            <Button type="button" variant="outline" onClick={goBack}>
              <ChevronLeft className="mr-1 h-4 w-4" aria-hidden />
              Geri
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
