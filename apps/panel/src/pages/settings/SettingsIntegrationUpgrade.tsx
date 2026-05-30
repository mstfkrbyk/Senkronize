import type { ReactElement } from 'react';

import { IntegrationProductPrompt } from '@/pages/connections/IntegrationProductPrompt';

interface Props {
  showNativeAccountingCta?: boolean;
}

/** Accounting-only org: API anahtarları / webhook için entegrasyon hattı yükseltmesi */
export function SettingsIntegrationUpgrade({
  showNativeAccountingCta = false,
}: Props): ReactElement {
  return <IntegrationProductPrompt showNativeAccountingCta={showNativeAccountingCta} />;
}
