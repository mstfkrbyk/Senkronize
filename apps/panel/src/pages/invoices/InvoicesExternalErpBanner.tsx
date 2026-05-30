import type { ReactElement } from 'react';
import { Info } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

import { invoicesT } from './translations';

/** EXTERNAL_ERP: yerel fatura listesi yerine harici ERP yönlendirmesi. */
export function InvoicesExternalErpBanner(): ReactElement {
  return (
    <Alert className="border-sky-200 bg-sky-50/80 text-sky-950">
      <Info className="h-4 w-4 text-sky-600" aria-hidden />
      <AlertTitle className="text-sky-950">{invoicesT('externalErp.bannerTitle')}</AlertTitle>
      <AlertDescription className="text-sky-900/90">
        <p>{invoicesT('externalErp.bannerDescription')}</p>
        <p className="mt-2">
          <Link
            to="/connections?tab=erp"
            className="font-medium text-sky-700 underline-offset-2 hover:underline"
          >
            {invoicesT('externalErp.connectionsLink')}
          </Link>
        </p>
      </AlertDescription>
    </Alert>
  );
}
