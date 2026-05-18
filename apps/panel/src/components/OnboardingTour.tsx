import type { ReactElement } from 'react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

const STORAGE_KEY = 'senkronize-panel-onboarding-tour-done';

const STEPS: readonly { path: string; title: string; description: string }[] = [
  {
    path: '/dashboard',
    title: 'Özet',
    description: 'Burada satış özetinizi görürsünüz.',
  },
  {
    path: '/connections',
    title: 'Bağlantılar',
    description: 'Pazaryeri hesaplarınızı burada bağlayın.',
  },
  {
    path: '/products',
    title: 'Ürünler',
    description: 'Ürünlerinizi buradan yönetin.',
  },
  {
    path: '/orders',
    title: 'Siparişler',
    description: 'Siparişleriniz burada listelenir.',
  },
] as const;

function isTourCompleted(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function markTourCompleted(): void {
  try {
    localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function OnboardingTour(): ReactElement | null {
  const navigate = useNavigate();
  const location = useLocation();
  const [visible, setVisible] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const initialRouteDone = useRef(false);

  useEffect(() => {
    if (isTourCompleted()) {
      return;
    }
    setVisible(true);
  }, []);

  useEffect(() => {
    if (!visible || initialRouteDone.current) {
      return;
    }
    initialRouteDone.current = true;
    navigate(STEPS[0].path, { replace: true });
  }, [visible, navigate]);

  const finish = useCallback((): void => {
    markTourCompleted();
    setVisible(false);
  }, []);

  const step = STEPS[stepIndex];

  useLayoutEffect(() => {
    if (!visible || !step) {
      return;
    }
    const el = document.querySelector<HTMLElement>(
      `[data-onboarding="${step.path}"]`,
    );
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [visible, step, location.pathname]);

  if (!visible || !step) {
    return null;
  }

  const isLast = stepIndex >= STEPS.length - 1;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-tour-title"
    >
      <Card className="pointer-events-auto w-full max-w-md border-border shadow-lg">
        <CardHeader className="pb-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Adım {stepIndex + 1} / {STEPS.length}
          </p>
          <CardTitle id="onboarding-tour-title" className="text-lg">
            {step.title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{step.description}</p>
        </CardContent>
        <CardFooter className="flex flex-wrap justify-end gap-2 border-t bg-muted/30">
          <Button type="button" variant="ghost" size="sm" onClick={finish}>
            Atla
          </Button>
          {isLast ? (
            <Button type="button" size="sm" onClick={finish}>
              Turu bitir
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={() => {
                const next = STEPS[stepIndex + 1];
                if (next) {
                  navigate(next.path);
                  setStepIndex((i) => i + 1);
                }
              }}
            >
              Sonraki
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
