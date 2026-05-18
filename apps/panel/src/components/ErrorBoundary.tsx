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
  onReset,
}: {
  error?: Error;
  onReset: () => void;
}): ReactElement {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 p-8">
      <div className="text-6xl">⚠️</div>
      <h2 className="text-xl font-semibold">Bir şeyler yanlış gitti</h2>
      <p className="text-muted-foreground max-w-md text-center text-sm">
        {error?.message ?? 'Beklenmedik bir hata oluştu.'}
      </p>
      <Button type="button" onClick={onReset}>
        Sayfayı Yenile
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
            onReset={() => {
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
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <DefaultCrashUI
            error={this.state.error}
            onReset={() => {
              this.setState({ hasError: false });
              window.location.reload();
            }}
          />
        )
      );
    }
    return this.props.children;
  }
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
