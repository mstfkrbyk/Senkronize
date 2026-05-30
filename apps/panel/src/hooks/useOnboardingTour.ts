import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { resolveOnboardingTourSteps } from '@/lib/onboarding-tour-steps';
import type { OnboardingTourStep } from '@/lib/onboarding-tour-steps';
import { useAccountingMode } from '@/hooks/useAccountingMode';
import { useAuthStore } from '@/store/auth.store';

export const ONBOARDING_TOUR_STORAGE_KEY = 'senkronize-panel-onboarding-tour-done';

export type { OnboardingTourStep } from '@/lib/onboarding-tour-steps';
export { ONBOARDING_TOUR_STEPS } from '@/lib/onboarding-tour-steps';

function isTourCompleted(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_TOUR_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function markTourCompleted(): void {
  try {
    localStorage.setItem(ONBOARDING_TOUR_STORAGE_KEY, '1');
  } catch {
    /* ignore */
  }
}

export interface UseOnboardingTourResult {
  visible: boolean;
  stepIndex: number;
  step: OnboardingTourStep | undefined;
  stepCount: number;
  isLast: boolean;
  finish: () => void;
  goNext: () => void;
}

export function useOnboardingTour(): UseOnboardingTourResult {
  const navigate = useNavigate();
  const location = useLocation();
  const orgProducts = useAuthStore((s) => s.currentOrg?.orgProducts);
  const { mode: accountingMode } = useAccountingMode();
  const steps = useMemo(
    () => resolveOnboardingTourSteps(orgProducts, accountingMode),
    [orgProducts, accountingMode],
  );
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
    const first = steps[0];
    if (first?.route && location.pathname !== first.route) {
      initialRouteDone.current = true;
      navigate(first.route, { replace: true });
    }
  }, [visible, navigate, location.pathname, steps]);

  const finish = useCallback((): void => {
    markTourCompleted();
    setVisible(false);
  }, []);

  const step = steps[stepIndex];
  const isLast = stepIndex >= steps.length - 1;

  useLayoutEffect(() => {
    if (!visible || !step) {
      return;
    }
    const el = document.querySelector<HTMLElement>(step.target);
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [visible, step, location.pathname]);

  const goNext = useCallback((): void => {
    if (isLast) {
      finish();
      return;
    }
    const next = steps[stepIndex + 1];
    if (next?.route) {
      navigate(next.route);
    }
    setStepIndex((i) => i + 1);
  }, [finish, isLast, navigate, stepIndex, steps]);

  return {
    visible,
    stepIndex,
    step,
    stepCount: steps.length,
    isLast,
    finish,
    goNext,
  };
}
