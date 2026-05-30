import { isAxiosError } from 'axios';
import { toast } from 'sonner';

import { api, getApiErrorMessage } from '@/lib/api';
import type { AccountingMode } from '@/types/auth';

export async function testMarketplaceConnection(
  platform: string,
  credentials: Record<string, string>,
): Promise<boolean | null> {
  try {
    const { data } = await api.post<{ connected: boolean }>(
      '/marketplace-connections/test',
      { platform, credentials },
    );
    return data.connected;
  } catch (error: unknown) {
    if (isAxiosError(error)) {
      toast.error(getApiErrorMessage(error));
      return null;
    }
    throw error;
  }
}

export async function saveMarketplaceConnection(
  platform: string,
  credentials: Record<string, string>,
): Promise<void> {
  try {
    await api.post('/marketplace-connections', { platform, credentials });
  } catch (error: unknown) {
    if (isAxiosError(error)) {
      toast.error(getApiErrorMessage(error));
      return;
    }
    throw error;
  }
}

export async function saveErpConnection(
  erpType: string,
  credentials: Record<string, string>,
): Promise<void> {
  try {
    await api.post('/erp-connections', { erpType, credentials });
  } catch (error: unknown) {
    if (isAxiosError(error)) {
      toast.error(getApiErrorMessage(error));
      return;
    }
    throw error;
  }
}

export async function completeOnboarding(payload: {
  name?: string;
  onboardingCompleted: true;
}): Promise<void> {
  await api.patch('/organizations/me', payload);
}

export async function patchOrganizationAccountingMode(
  accountingMode: AccountingMode,
): Promise<void> {
  await api.patch('/organizations/me', { accountingMode });
}
