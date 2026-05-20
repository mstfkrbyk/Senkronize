import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export const ONBOARDING_TOUR_STORAGE_KEY = 'senkronize-panel-onboarding-tour-done';

export interface OnboardingTourStep {
  target: string;
  content: string;
  /** Hedef görünür değilse gidilecek rota */
  route?: string;
}

export const ONBOARDING_TOUR_STEPS: readonly OnboardingTourStep[] = [
  {
    target: '[data-tour="sidebar-connections"]',
    content: 'Pazaryeri ve ERP bağlantılarınızı buradan ekleyin',
    route: '/connections',
  },
  {
    target: '[data-tour="sidebar-products"]',
    content: 'Ürünlerinizi ve stok durumunuzu buradan yönetin',
    route: '/products',
  },
  {
    target: '[data-tour="sidebar-orders"]',
    content: 'Tüm kanallardan gelen siparişleri tek ekranda görün',
    route: '/orders',
  },
  {
    target: '[data-tour="sidebar-pricing"]',
    content: 'BuyBox optimizasyonu ve fiyat kurallarını buradan ayarlayın',
    route: '/pricing',
  },
  {
    target: '[data-tour="dashboard-sync"]',
    content: 'Anlık senkronizasyon durumunuzu buradan takip edin',
    route: '/dashboard',
  },
] as const;

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
  isLast: boolean;
  finish: () => void;
  goNext: () => void;
}

export function useOnboardingTour(): UseOnboardingTourResult {
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
    const first = ONBOARDING_TOUR_STEPS[0];
    if (first?.route && location.pathname !== first.route) {
      initialRouteDone.current = true;
      navigate(first.route, { replace: true });
    }
  }, [visible, navigate, location.pathname]);

  const finish = useCallback((): void => {
    markTourCompleted();
    setVisible(false);
  }, []);

  const step = ONBOARDING_TOUR_STEPS[stepIndex];
  const isLast = stepIndex >= ONBOARDING_TOUR_STEPS.length - 1;

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
    const next = ONBOARDING_TOUR_STEPS[stepIndex + 1];
    if (next?.route) {
      navigate(next.route);
    }
    setStepIndex((i) => i + 1);
  }, [finish, isLast, navigate, stepIndex]);

  return {
    visible,
    stepIndex,
    step,
    isLast,
    finish,
    goNext,
  };
}
