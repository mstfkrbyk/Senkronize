import { formatNavPageContext } from '@/lib/nav-page-context';

/** Ortak menü grubu — kurulum panel dışı tam ekran akışında sabit üst bağlam. */
export const ONBOARDING_NAV_GROUP_LABEL = 'Ortak';

export const ONBOARDING_PAGE_LABEL = 'Kurulum';

/** Kurulum sihirbazı rotası — `OnboardingPage` kökünden yönlendirilir. */
export const ONBOARDING_WIZARD_PATH = '/onboarding/wizard';

/** Üst bağlam (adım yok): «Ortak > Kurulum». */
export function formatOnboardingRootNavContext(): string {
  return formatNavPageContext(ONBOARDING_NAV_GROUP_LABEL, ONBOARDING_PAGE_LABEL);
}

/** Üst bağlam: «Ortak > Kurulum > {adım}». */
export function formatOnboardingNavContext(stepLabel: string): string {
  return formatNavPageContext(
    ONBOARDING_NAV_GROUP_LABEL,
    ONBOARDING_PAGE_LABEL,
    stepLabel,
  );
}

/** Sihirbaz adım göstergesi — ürün hattı kayıtta kilitliyse yalnızca paket seçimi. */
export function resolveProductPlanStepLabel(selectionLocked: boolean): string {
  return selectionLocked ? 'Paket seçimi' : 'Ürün ve paket';
}
