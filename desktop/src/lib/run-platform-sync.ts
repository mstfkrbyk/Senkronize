import { showDesktopNotification } from '@/lib/desktop-notify';
import { appendSyncLog } from '@/lib/sync-log-store';
import { loadSyncSettings } from '@/lib/sync-settings-store';
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

  const syncSettings = loadSyncSettings();
  let lastAt = new Date().toISOString();
  let anyFail = false;
  const started = Date.now();

  try {
    await tauriApi.setTrayIndicator('syncing');
    for (const p of PLATFORMS) {
      if (!syncSettings.syncStock && !syncSettings.syncOrder && !syncSettings.syncProduct) {
        break;
      }
      try {
        const res = await tauriApi.triggerSync(state.apiUrl, state.token.token, p.id);
        lastAt = res.syncedAt;
        state.addSyncLog({ ...res, message: `${p.label}: ${res.message}` });
        appendSyncLog({
          type: 'STOCK',
          status: res.success ? 'SUCCESS' : 'FAILED',
          itemCount: 0,
          duration: Date.now() - started,
          error: res.success ? undefined : res.message,
        });
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
        appendSyncLog({
          type: 'STOCK',
          status: 'FAILED',
          itemCount: 0,
          duration: Date.now() - started,
          error: message,
        });
      }
    }

    await tauriApi.recordLastSync(lastAt);
    await tauriApi.setTrayIndicator(anyFail ? 'error' : 'idle');
    if (anyFail && syncSettings.notifyOnError) {
      showDesktopNotification('Senkronize', 'Senkron sırasında hata oluştu.');
    } else if (!anyFail && syncSettings.notifyOnComplete) {
      showDesktopNotification('Senkronize', 'Senkron tamamlandı.');
    }
  } catch (err) {
    anyFail = true;
    const message = err instanceof Error ? err.message : String(err);
    state.addSyncLog({
      success: false,
      message,
      syncedAt: new Date().toISOString(),
    });
    appendSyncLog({
      type: 'STOCK',
      status: 'FAILED',
      itemCount: 0,
      duration: Date.now() - started,
      error: message,
    });
    await tauriApi.setTrayIndicator('error');
    if (syncSettings.notifyOnError) {
      showDesktopNotification('Senkronize', `Senkron hatası: ${message}`);
    }
  }
}
