import * as Sentry from '@sentry/react';
import type { ErrorInfo, ReactElement, ReactNode } from 'react';
import React from 'react';

import { Button } from '@/components/ui/button';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface ErrorBoundaryProps {
  children?: ReactNode;
  fallback?: ReactNode;
}

function DefaultCrashUI({
  error,
  onRetry,
}: {
  error?: Error;
  onRetry: () => void;
}): ReactElement {
  const isDev = import.meta.env.DEV;

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 p-8">
      <div className="text-6xl" aria-hidden>
        ⚠️
      </div>
      <h2 className="text-xl font-semibold text-foreground">Bir şeyler yanlış gitti</h2>
      <p className="max-w-md text-center text-sm text-muted-foreground">
        Bu bölüm yüklenirken beklenmedik bir hata oluştu. Yeniden deneyebilir veya sayfayı
        yenileyebilirsiniz.
      </p>
      {isDev && error ? (
        <pre className="max-h-48 max-w-full overflow-auto rounded-md border border-border bg-muted p-3 text-left text-xs text-foreground">
          {error.stack ?? error.message}
        </pre>
      ) : null}
      <Button type="button" onClick={onRetry}>
        Yeniden dene
      </Button>
    </div>
  );
}

function Passthrough({ children }: { children?: ReactNode }): ReactElement {
  return <>{children}</>;
}

const SentryPassthroughBoundary =
  typeof import.meta.env.VITE_SENTRY_DSN === 'string' &&
  import.meta.env.VITE_SENTRY_DSN.length > 0
    ? Sentry.withErrorBoundary(Passthrough, {
        fallback: ({ error, resetError }) => (
          <DefaultCrashUI
            error={error instanceof Error ? error : undefined}
            onRetry={() => {
              resetError();
              window.location.reload();
            }}
          />
        ),
      })
    : null;

class LegacyErrorBoundary extends React.Component<
  React.PropsWithChildren<ErrorBoundaryProps>,
  ErrorBoundaryState
> {
  constructor(props: React.PropsWithChildren<ErrorBoundaryProps>) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('ErrorBoundary caught:', error, info);
    if (typeof import.meta.env.VITE_SENTRY_DSN === 'string' && import.meta.env.VITE_SENTRY_DSN.length > 0) {
      Sentry.captureException(error, { extra: { componentStack: info.componentStack } });
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <DefaultCrashUI
            error={this.state.error}
            onRetry={() => {
              this.setState({ hasError: false, error: undefined });
              window.location.reload();
            }}
          />
        )
      );
    }
    return this.props.children;
  }
}

export function AppErrorBoundary({ children }: { children: ReactNode }): ReactElement {
  return (
    <Sentry.ErrorBoundary
      fallback={({ error, resetError }) => (
        <div className="flex min-h-screen flex-col items-center justify-center p-8">
          <h2 className="mb-4 text-2xl font-bold">Bir hata oluştu</h2>
          <p className="mb-6 text-muted-foreground">
            {(error as Error).message}
          </p>
          <Button type="button" onClick={resetError}>
            Yeniden Dene
          </Button>
        </div>
      )}
    >
      {children}
    </Sentry.ErrorBoundary>
  );
}

export function ErrorBoundary({
  children,
  fallback,
}: ErrorBoundaryProps): ReactElement {
  if (SentryPassthroughBoundary) {
    const Boundary = SentryPassthroughBoundary;
    return <Boundary>{children}</Boundary>;
  }
  return (
    <LegacyErrorBoundary fallback={fallback}>{children}</LegacyErrorBoundary>
  );
}
