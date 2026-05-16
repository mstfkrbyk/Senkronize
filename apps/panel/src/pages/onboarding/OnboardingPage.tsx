import type { ReactElement } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { api, getApiErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  completeOnboarding,
  saveErpConnection,
  saveMarketplaceConnection,
} from '@/pages/onboarding/onboarding.api';
import { ERP_OPTIONS } from '@/pages/onboarding/onboarding.options';
import type { OnboardingState } from '@/pages/onboarding/onboarding.types';
import { Step1Welcome } from '@/pages/onboarding/steps/Step1Welcome';
import { Step2Marketplace } from '@/pages/onboarding/steps/Step2Marketplace';
import { Step3Erp } from '@/pages/onboarding/steps/Step3Erp';
import { Step4Done } from '@/pages/onboarding/steps/Step4Done';
import { useAuthStore } from '@/store/auth.store';
import type { MeResponse } from '@/types/auth';

const STEP_COUNT = 4;

function initialState(orgName: string): OnboardingState {
  return {
    currentStep: 1,
    orgName,
    selectedMarketplace: null,
    marketplaceCredentials: {},
    selectedErp: null,
    erpCredentials: {},
  };
}

export function OnboardingPage(): ReactElement {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: me } = useAuth();
  const setOrg = useAuthStore((s) => s.setOrg);

  const [state, setState] = useState<OnboardingState | null>(null);
  const [marketplaceTestOk, setMarketplaceTestOk] = useState(false);

  useEffect(() => {
    document.title = 'Kurulum — Senkronize';
  }, []);

  useEffect(() => {
    if (!me) {
      return;
    }
    setState((prev) => {
      if (prev) {
        return prev;
      }
      return initialState(me.organization.name);
    });
  }, [me]);

  const progressPercent = useMemo(() => {
    if (!state) {
      return 0;
    }
    return Math.round((state.currentStep / STEP_COUNT) * 100);
  }, [state]);

  const finishMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      if (!me || !state) {
        return;
      }
      const nameChanged = state.orgName.trim() !== me.organization.name;
      await completeOnboarding({
        onboardingCompleted: true,
        ...(nameChanged ? { name: state.orgName.trim() } : {}),
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
    onSuccess: () => {
      toast.success('Kurulum kaydedildi.');
      navigate('/dashboard', { replace: true });
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error));
    },
  });

  if (!me || !state) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-label="Yükleniyor" />
      </div>
    );
  }

  function goNext(): void {
    setState((s) => {
      if (!s) {
        return s;
      }
      return { ...s, currentStep: Math.min(STEP_COUNT, s.currentStep + 1) };
    });
  }

  function goBack(): void {
    setState((s) => {
      if (!s) {
        return s;
      }
      if (s.currentStep === 2) {
        queueMicrotask(() => {
          setMarketplaceTestOk(false);
        });
      }
      return { ...s, currentStep: Math.max(1, s.currentStep - 1) };
    });
  }

  async function handlePrimaryNext(): Promise<void> {
    if (!state) {
      return;
    }
    if (state.currentStep === 2) {
      if (!state.selectedMarketplace || !marketplaceTestOk) {
        toast.error('Önce pazaryeri testini başarıyla tamamlayın.');
        return;
      }
      try {
        await saveMarketplaceConnection(
          state.selectedMarketplace,
          state.marketplaceCredentials,
        );
      } catch (error: unknown) {
        toast.error(getApiErrorMessage(error));
        return;
      }
    }
    if (state.currentStep === 3) {
      if (state.selectedErp) {
        const valid = ERP_OPTIONS.find((e) => e.id === state.selectedErp)?.fields.every(
          (f) => !f.required || Boolean(state.erpCredentials[f.key]?.trim()),
        );
        if (!valid) {
          toast.error('ERP alanlarını doldurun veya atlayın.');
          return;
        }
        try {
          await saveErpConnection(state.selectedErp, state.erpCredentials);
        } catch (error: unknown) {
          toast.error(getApiErrorMessage(error));
          return;
        }
      }
    }
    goNext();
  }

  const stepContent = (() => {
    switch (state.currentStep) {
      case 1:
        return (
          <Step1Welcome
            orgName={state.orgName}
            onOrgNameChange={(orgName) =>
              setState((s) => (s ? { ...s, orgName } : s))
            }
            onNext={goNext}
          />
        );
      case 2:
        return (
          <Step2Marketplace
            selectedMarketplace={state.selectedMarketplace}
            credentials={state.marketplaceCredentials}
            onSelectMarketplace={(id) =>
              setState((s) =>
                s
                  ? {
                      ...s,
                      selectedMarketplace: id,
                      marketplaceCredentials: {},
                    }
                  : s,
              )
            }
            onCredentialChange={(key, value) =>
              setState((s) =>
                s
                  ? {
                      ...s,
                      marketplaceCredentials: {
                        ...s.marketplaceCredentials,
                        [key]: value,
                      },
                    }
                  : s,
              )
            }
            onTestSuccess={() => setMarketplaceTestOk(true)}
            testPassed={marketplaceTestOk}
            onResetTest={() => setMarketplaceTestOk(false)}
          />
        );
      case 3:
        return (
          <Step3Erp
            selectedErp={state.selectedErp}
            credentials={state.erpCredentials}
            onSelectErp={(id) =>
              setState((s) =>
                s
                  ? {
                      ...s,
                      selectedErp: id,
                      erpCredentials: id ? s.erpCredentials : {},
                    }
                  : s,
              )
            }
            onCredentialChange={(key, value) =>
              setState((s) =>
                s
                  ? {
                      ...s,
                      erpCredentials: { ...s.erpCredentials, [key]: value },
                    }
                  : s,
              )
            }
            onSkip={() =>
              setState((s) =>
                s
                  ? {
                      ...s,
                      currentStep: 4,
                      selectedErp: null,
                      erpCredentials: {},
                    }
                  : s,
              )
            }
          />
        );
      case 4:
        return (
          <Step4Done
            selectedMarketplace={state.selectedMarketplace}
            selectedErp={state.selectedErp}
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
              Adım {state.currentStep} / {STEP_COUNT}
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
            const done = state.currentStep > step;
            const active = state.currentStep === step;
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

        {state.currentStep > 1 && state.currentStep < 4 ? (
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            <Button type="button" variant="outline" onClick={goBack}>
              <ChevronLeft className="mr-1 h-4 w-4" aria-hidden />
              Geri
            </Button>
            <Button
              type="button"
              onClick={() => void handlePrimaryNext()}
              disabled={
                (state.currentStep === 2 &&
                  (!state.selectedMarketplace || !marketplaceTestOk)) ||
                finishMutation.isPending
              }
            >
              İleri
              <ChevronRight className="ml-1 h-4 w-4" aria-hidden />
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
