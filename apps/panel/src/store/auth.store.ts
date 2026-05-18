import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { OrgPlanTier, OrgType } from '@/types/auth';

export interface AuthUserSnapshot {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface CurrentOrgSnapshot {
  id: string;
  name: string;
  slug: string;
  type: OrgType;
  onboardingCompleted: boolean;
  plan: OrgPlanTier;
}

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  sessionId: string | null;
  user: AuthUserSnapshot | null;
  currentOrg: CurrentOrgSnapshot | null;
  setTokens: (token: string, refreshToken: string, sessionId?: string) => void;
  setUser: (user: AuthUserSnapshot | null) => void;
  setOrg: (org: CurrentOrgSnapshot | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      refreshToken: null,
      sessionId: null,
      user: null,
      currentOrg: null,
      setTokens: (token, refreshToken, sessionId) =>
        set({
          token,
          refreshToken,
          ...(sessionId !== undefined ? { sessionId } : {}),
        }),
      setUser: (user) => set({ user }),
      setOrg: (currentOrg) => set({ currentOrg }),
      logout: () =>
        set({
          token: null,
          refreshToken: null,
          sessionId: null,
          user: null,
          currentOrg: null,
        }),
    }),
    {
      name: 'senkronize-auth',
      merge: (persisted, current) => {
        if (!persisted || typeof persisted !== 'object') {
          return current as AuthState;
        }
        const p = persisted as Partial<AuthState>;
        const co = p.currentOrg;
        return {
          ...(current as AuthState),
          ...p,
          sessionId: typeof p.sessionId === 'string' ? p.sessionId : null,
          currentOrg:
            co && typeof co === 'object'
              ? {
                  ...co,
                  onboardingCompleted: Boolean(
                    (co as CurrentOrgSnapshot).onboardingCompleted,
                  ),
                  plan:
                    (co as Partial<CurrentOrgSnapshot>).plan ?? 'BASLANGIC',
                  type:
                    (co as Partial<CurrentOrgSnapshot>).type ?? 'DIRECT',
                }
              : null,
        };
      },
    },
  ),
);
