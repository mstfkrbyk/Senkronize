import type { ReactElement } from 'react';
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ErpSetupWizardContent } from '@/pages/connections/ErpSetupWizard';

export function ErpSetupWizardPage(): ReactElement {
  useEffect(() => {
    document.title = 'ERP Kurulumu — Senkronize';
  }, []);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-8">
      <Button variant="ghost" size="sm" className="-ml-2 w-fit" asChild>
        <Link to="/connections">
          <ChevronLeft className="mr-1 h-4 w-4" aria-hidden />
          Bağlantılara dön
        </Link>
      </Button>
      <ErpSetupWizardContent variant="page" />
    </div>
  );
}
