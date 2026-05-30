import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';

import { api } from '@/lib/api';

import { mapCustomerStatementApi } from './customer-statement-map';
import type {
  CustomerStatementApi,
  CustomerStatementDto,
  CustomerStatementView,
} from './customer-statement.types';

const EMPTY_STATEMENT: CustomerStatementDto = {
  totalDebit: 0,
  totalCredit: 0,
  balance: 0,
  lines: [],
};

function isStatementUnavailable(error: unknown): boolean {
  if (!isAxiosError(error)) {
    return false;
  }
  const status = error.response?.status;
  return status === 404 || status === 501 || status === 503;
}

export function useCustomerStatement(
  customerId: string,
  options?: { enabled?: boolean },
) {
  const queryEnabled =
    customerId.length > 0 && (options?.enabled ?? true);
  return useQuery({
    queryKey: ['customer-statement', customerId],
    enabled: queryEnabled,
    queryFn: async (): Promise<CustomerStatementView> => {
      try {
        const { data } = await api.get<{ data: CustomerStatementApi }>(
          `/accounting/customers/${customerId}/statement`,
        );
        return { ...mapCustomerStatementApi(data.data), unavailable: false };
      } catch (error) {
        if (isStatementUnavailable(error)) {
          return { ...EMPTY_STATEMENT, unavailable: true };
        }
        throw error;
      }
    },
    staleTime: 30_000,
  });
}
