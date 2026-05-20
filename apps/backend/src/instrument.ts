import * as Sentry from '@sentry/nestjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: process.env.NODE_ENV === 'production',
  environment: process.env.NODE_ENV ?? 'development',
  release: process.env.npm_package_version,

  tracesSampleRate: 0.1,
  profilesSampleRate: 0.1,

  beforeSend(event) {
    if (process.env.NODE_ENV !== 'production') {
      return null;
    }
    if (event.exception?.values?.[0]?.type === 'RateLimitExceededException') {
      return null;
    }
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

  integrations: [Sentry.prismaIntegration()],
});
