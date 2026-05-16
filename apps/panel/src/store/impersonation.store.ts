import { create } from 'zustand';

import { useAuthStore } from '@/store/auth.store';

interface ImpersonationState {
  isImpersonating: boolean;
  impersonatedOrg: { id: string; name: string } | null;
  impersonationToken: string | null;
  originalToken: string | null;
  startImpersonation: (org: { id: string; name: string }, token: string) => void;
  stopImpersonation: () => void;
}

export const useImpersonationStore = create<ImpersonationState>((set) => ({
  isImpersonating: false,
  impersonatedOrg: null,
  impersonationToken: null,
  originalToken: null,
  startImpersonation: (org, token) =>
    set((state) => ({
      isImpersonating: true,
      impersonatedOrg: org,
      impersonationToken: token,
      originalToken: state.originalToken ?? useAuthStore.getState().token,
    })),
  stopImpersonation: () =>
    set({
      isImpersonating: false,
      impersonatedOrg: null,
      impersonationToken: null,
      originalToken: null,
    }),
}));
