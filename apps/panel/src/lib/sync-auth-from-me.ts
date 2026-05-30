import type { MeResponse } from '@/types/auth';
import { useAuthStore } from '@/store/auth.store';
import { useImpersonationStore } from '@/store/impersonation.store';

/** `/auth/me` yanıtını Zustand oturumuna yazar (menü, accountingMode, orgProducts). */
export function syncAuthStoreFromMe(me: MeResponse): void {
  const { setUser, setOrg } = useAuthStore.getState();
  setUser({
    id: me.user.id,
    email: me.user.email,
    name: me.user.name,
    role: me.user.role,
  });
  setOrg({
    id: me.organization.id,
    name: me.organization.name,
    slug: me.organization.slug,
    type: me.organization.type,
    onboardingCompleted: me.organization.onboardingCompleted,
    plan: me.organization.plan,
    internalAccount: me.organization.internalAccount === true,
    billingExempt: me.organization.billingExempt === true,
    orgProducts: me.organization.orgProducts,
    accountingMode: me.organization.accountingMode,
  });
  if (me.organization.type === 'PARTNER' && !me.isImpersonating) {
    useImpersonationStore.getState().stopImpersonation();
  }
}
