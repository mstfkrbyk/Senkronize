import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { api } from '@/lib/api';
import type { MeResponse } from '@/types/auth';
import { useAuthStore } from '@/store/auth.store';

export function useAuth(): UseQueryResult<MeResponse, Error> {
  const token = useAuthStore((s) => s.token);

  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async (): Promise<MeResponse> => {
      const { data } = await api.get<MeResponse>('/auth/me');
      return data;
    },
    enabled: Boolean(token),
  });
}
