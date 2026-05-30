import { getDemoLoginPassword } from '@/lib/demo-login';

export const HEPSIBURADA_DEMO_EMAIL = 'demo-hepsiburada@senkronize.com';

/** Giriş sayfasında Hepsiburada hızlı giriş butonu (local dev veya demo modu). */
export function isHepsiburadaQuickLoginEnabled(): boolean {
  return (
    import.meta.env.DEV ||
    import.meta.env.VITE_DEMO_MODE === 'true' ||
    import.meta.env.VITE_HEPSIBURADA_LOGIN === 'true'
  );
}

export function getHepsiburadaQuickLoginCredentials(): {
  email: string;
  password: string;
} {
  return {
    email: HEPSIBURADA_DEMO_EMAIL,
    password: getDemoLoginPassword(HEPSIBURADA_DEMO_EMAIL),
  };
}
