import type { ReactElement } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ONBOARDING_TOUR_STEPS,
  useOnboardingTour,
} from '@/hooks/useOnboardingTour';

export function OnboardingTour(): ReactElement | null {
  const { visible, stepIndex, step, isLast, finish, goNext } = useOnboardingTour();

  if (!visible || !step) {
    return null;
  }

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
            Adım {stepIndex + 1} / {ONBOARDING_TOUR_STEPS.length}
          </p>
          <CardTitle id="onboarding-tour-title" className="text-lg">
            Panel turu
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{step.content}</p>
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
            <Button type="button" size="sm" onClick={goNext}>
              Sonraki
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
