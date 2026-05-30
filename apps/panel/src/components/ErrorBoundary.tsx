import * as Sentry from '@sentry/react';
import type { ErrorInfo, ReactElement, ReactNode } from 'react';
import React from 'react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

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
    <div className="flex min-h-[400px] items-center justify-center p-6">
      <Card className="w-full max-w-md text-center">
        <CardHeader className="items-center space-y-2">
          <div className="text-5xl" aria-hidden>
            ⚠️
          </div>
          <CardTitle>Bir şeyler yanlış gitti</CardTitle>
          <CardDescription>
            Bu bölüm yüklenirken beklenmedik bir hata oluştu. Yeniden deneyebilir veya
            sayfayı yenileyebilirsiniz.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isDev && error ? (
            <pre className="max-h-48 max-w-full overflow-auto rounded-md border border-border bg-muted p-3 text-left text-xs text-foreground">
              {error.stack ?? error.message}
            </pre>
          ) : null}
          <Button type="button" className="w-full" onClick={onRetry}>
            Yeniden dene
          </Button>
        </CardContent>
      </Card>
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
        <DefaultCrashUI
          error={error instanceof Error ? error : undefined}
          onRetry={() => {
            resetError();
            window.location.reload();
          }}
        />
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
