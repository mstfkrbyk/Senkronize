import type { ReactElement } from 'react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ChevronLeft, Server } from 'lucide-react';

import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { usePageTitle } from '@/hooks/usePageTitle';
import { NAV_GROUP_LABEL_KEYS } from '@/lib/nav-match';
import {
  ERP_SETUP_PAGE_LABEL,
  formatErpSetupNavContext,
} from '@/pages/connections/erp-setup-nav-context';
import { ErpSetupWizardContent } from '@/pages/connections/ErpSetupWizard';

export function ErpSetupWizardPage(): ReactElement {
  const { t } = useTranslation();
  const navContextLine = useMemo(
    () => formatErpSetupNavContext(t(NAV_GROUP_LABEL_KEYS.externalErp)),
    [t],
  );

  usePageTitle(ERP_SETUP_PAGE_LABEL);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title={ERP_SETUP_PAGE_LABEL}
        context={navContextLine}
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link to="/connections">
              <ChevronLeft className="mr-1 h-4 w-4" aria-hidden />
              Bağlantılara dön
            </Link>
          </Button>
        }
      />
      <Card>
        <CardContent className="pt-6">
          <div className="mb-6 flex items-start gap-3 border-b pb-6">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-sky-200 bg-sky-500/10 text-sky-600">
              <Server className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <p className="font-medium text-primary">Harici ERP Entegrasyonu</p>
              <p className="text-sm text-muted-foreground">
                Muhasebe yazılımınızı bağlayın; stok, fatura ve müşteri verileri otomatik senkronize olsun.
              </p>
            </div>
          </div>
          <ErpSetupWizardContent variant="page" />
        </CardContent>
      </Card>
    </div>
  );
}
