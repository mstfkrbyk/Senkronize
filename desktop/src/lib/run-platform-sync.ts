import { tauriApi } from '@/lib/tauri';
import { useAppStore } from '@/store/app.store';

const PLATFORMS = [
  { id: 'TRENDYOL', label: 'Trendyol' },
  { id: 'HEPSIBURADA', label: 'Hepsiburada' },
] as const;

/**
 * Trendyol ve Hepsiburada için ardışık senkron; tray / otomatik senkron / manuel tetiklerde ortak kullanılır.
 */
export async function runFullPlatformSync(): Promise<void> {
  const state = useAppStore.getState();
  if (!state.token) {
    return;
  }

  let lastAt = new Date().toISOString();
  let anyFail = false;

  try {
    await tauriApi.setTrayIndicator('syncing');
    for (const p of PLATFORMS) {
      try {
        const res = await tauriApi.triggerSync(state.apiUrl, state.token.token, p.id);
        lastAt = res.syncedAt;
        state.addSyncLog({ ...res, message: `${p.label}: ${res.message}` });
        if (!res.success) {
          anyFail = true;
        }
      } catch (err) {
        anyFail = true;
        const message = err instanceof Error ? err.message : String(err);
        state.addSyncLog({
          success: false,
          message: `${p.label}: ${message}`,
          syncedAt: new Date().toISOString(),
        });
      }
    }

    await tauriApi.recordLastSync(lastAt);
    await tauriApi.setTrayIndicator(anyFail ? 'error' : 'idle');
  } catch (err) {
    anyFail = true;
    const message = err instanceof Error ? err.message : String(err);
    state.addSyncLog({
      success: false,
      message,
      syncedAt: new Date().toISOString(),
    });
    await tauriApi.setTrayIndicator('error');
  }
}
