import posthog from 'posthog-js';
import { useEffect, useState } from 'react';

export function useFeatureFlag(flag: string): boolean {
  const posthogKey = import.meta.env.VITE_POSTHOG_KEY;
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (!posthogKey) {
      return;
    }
    const update = (): void => {
      setEnabled(posthog.isFeatureEnabled(flag) ?? false);
    };
    update();
    const unsubscribe = posthog.onFeatureFlags(update);
    return unsubscribe;
  }, [flag, posthogKey]);

  if (!posthogKey) {
    return false;
  }
  return enabled;
}
