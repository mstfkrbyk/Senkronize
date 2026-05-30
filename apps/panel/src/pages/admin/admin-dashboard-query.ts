import { keepPreviousData } from '@tanstack/react-query';

/** Admin istatistikleri ağır; sekme odağında yeniden çekme ve sık refetch yapma. */
export const ADMIN_STATS_QUERY_OPTIONS = {
  staleTime: 5 * 60_000,
  gcTime: 10 * 60_000,
  refetchOnWindowFocus: false,
  placeholderData: keepPreviousData,
} as const;
