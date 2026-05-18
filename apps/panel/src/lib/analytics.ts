import posthog from 'posthog-js';

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY;
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST ?? 'https://eu.i.posthog.com';

export function initAnalytics(): void {
  if (!POSTHOG_KEY) {
    return;
  }
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    capture_pageview: false,
    capture_pageleave: true,
    autocapture: false,
    persistence: 'localStorage',
    loaded: (ph) => {
      if (import.meta.env.DEV) {
        ph.debug();
      }
    },
  });
}

export function identifyUser(userId: string, properties: Record<string, unknown>): void {
  if (!POSTHOG_KEY) {
    return;
  }
  posthog.identify(userId, properties);
}

export function resetAnalytics(): void {
  if (!POSTHOG_KEY) {
    return;
  }
  posthog.reset();
}

export function track(event: string, properties?: Record<string, unknown>): void {
  if (!POSTHOG_KEY) {
    return;
  }
  posthog.capture(event, properties);
}

export function trackPageView(path: string): void {
  if (!POSTHOG_KEY) {
    return;
  }
  posthog.capture('$pageview', { $current_url: path });
}
