import type { ErrorInfo, ReactNode } from 'react';
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

export class ErrorBoundary extends React.Component<
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
          <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 p-8">
            <div className="text-6xl">⚠️</div>
            <h2 className="text-xl font-semibold">Bir şeyler yanlış gitti</h2>
            <p className="text-muted-foreground max-w-md text-center text-sm">
              {this.state.error?.message ?? 'Beklenmedik bir hata oluştu.'}
            </p>
            <Button
              type="button"
              onClick={() => {
                this.setState({ hasError: false });
                window.location.reload();
              }}
            >
              Sayfayı Yenile
            </Button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
