import type { ReactElement, ReactNode } from 'react';
import { Navigate } from 'react-router-dom';

import { useIntegrationOpsAccess } from '@/hooks/useIntegrationOpsAccess';

interface Props {
  children: ReactNode;
}

/** Sync geçmişi, log ve çakışma sayfaları — yalnızca platform operasyonu. */
export function IntegrationOpsRoute({ children }: Props): ReactElement {
  const canOps = useIntegrationOpsAccess();

  if (!canOps) {
    return <Navigate to="/connections" replace />;
  }

  return <>{children}</>;
}
