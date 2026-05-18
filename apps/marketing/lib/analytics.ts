'use client';

import posthog from 'posthog-js';

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com';

let initialized = false;

export function initMarketingAnalytics(): void {
  if (typeof window === 'undefined' || !POSTHOG_KEY || initialized) {
    return;
  }
  initialized = true;
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    capture_pageview: false,
    capture_pageleave: true,
    autocapture: false,
    persistence: 'localStorage',
    loaded: (ph) => {
      if (process.env.NODE_ENV === 'development') {
        ph.debug();
      }
    },
  });
}

export function track(event: string, properties?: Record<string, unknown>): void {
  if (!POSTHOG_KEY) {
    return;
  }
  posthog.capture(event, properties);
}

export function captureMarketingPageView(url: string): void {
  if (!POSTHOG_KEY) {
    return;
  }
  posthog.capture('$pageview', { $current_url: url });
}
