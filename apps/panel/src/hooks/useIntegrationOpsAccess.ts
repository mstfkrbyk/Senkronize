import { useAuth } from '@/hooks/useAuth';
import { canViewIntegrationOps } from '@/lib/integration-ops-access';
import { useAuthStore } from '@/store/auth.store';

/** Rate limit, manuel sync, sync geçmişi vb. platform operasyon görünürlüğü. */
export function useIntegrationOpsAccess(): boolean {
  const { data: me } = useAuth();
  const storeRole = useAuthStore((s) => s.user?.role);
  const role = me?.user.role ?? storeRole;
  return canViewIntegrationOps(role);
}
