import { api } from '@/lib/api';

/** MVP: gerçek test endpoint’i gelene kadar gecikmeli başarı. */
export async function mockTestMarketplaceConnection(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 1500));
}

/**
 * MVP: `POST /marketplace-connections` henüz yok; istek gövdesi ileride kullanılacak şekilde hazır.
 * Şimdilik ağ hatası olmaması için yerel gecikme ile başarı döner.
 */
export async function saveMarketplaceConnection(
  platform: string,
  credentials: Record<string, string>,
): Promise<void> {
  void platform;
  void credentials;
  await new Promise((resolve) => setTimeout(resolve, 600));
}

/** MVP: `POST /erp-connections` yok; başarı simülasyonu. */
export async function saveErpConnection(
  erpId: string,
  credentials: Record<string, string>,
): Promise<void> {
  void erpId;
  void credentials;
  await new Promise((resolve) => setTimeout(resolve, 600));
}

export async function completeOnboarding(payload: {
  name?: string;
  onboardingCompleted: true;
}): Promise<void> {
  await api.patch('/organizations/me', payload);
}
