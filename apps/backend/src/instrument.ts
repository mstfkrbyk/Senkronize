import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

function parseTracesSampleRate(): number {
  const raw = process.env.SENTRY_TRACES_SAMPLE_RATE?.trim();
  if (!raw) {
    return process.env.NODE_ENV === 'production' ? 0.1 : 1.0;
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 1) {
    return process.env.NODE_ENV === 'production' ? 0.1 : 1.0;
  }
  return n;
}

export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN?.trim();
  if (!dsn) {
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    tracesSampleRate: parseTracesSampleRate(),
    profilesSampleRate: 0.1,
    integrations: [nodeProfilingIntegration()],
    beforeSend(event) {
      if (event.request?.data && typeof event.request.data === 'object') {
        const data = event.request.data as Record<string, unknown>;
        ['password', 'apiKey', 'apiSecret', 'credentialsEnc', 'accessToken'].forEach(
          (key) => {
            if (key in data) {
              data[key] = '[REDACTED]';
            }
          },
        );
      }
      return event;
    },
  });
}
