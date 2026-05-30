import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { Info, Share2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAccountingMode } from '@/hooks/useAccountingMode';
import { useAuthStore } from '@/store/auth.store';

import { CustomReportBuilder } from './CustomReportBuilder';
import { SavedReportsList } from './SavedReportsList';
import { ShareReportModal } from './ShareReportModal';
import {
  resolveCustomReportPresentation,
  resolveReportsProductAccess,
} from './reports-tabs.config';

export function CustomReportsTab(): ReactElement {
  const { t } = useTranslation();
  const orgProducts = useAuthStore((s) => s.currentOrg?.orgProducts);
  const productAccess = useMemo(
    () => resolveReportsProductAccess(orgProducts),
    [orgProducts],
  );
  const { mode: accountingMode, isLoading: accountingModeLoading } =
    useAccountingMode();
  const customPresentation = useMemo(
    () => resolveCustomReportPresentation(productAccess, accountingMode),
    [productAccess, accountingMode],
  );
  const showFullCustom = customPresentation === 'full';
  const [shareOpen, setShareOpen] = useState(false);
  const [shareReportId, setShareReportId] = useState<string | null>(null);
  const [listKey, setListKey] = useState(0);

  if (accountingModeLoading && productAccess.hasAccounting) {
    return (
      <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
    );
  }

  if (!showFullCustom) {
    return (
      <div id="report-custom" className="space-y-6">
        <Alert className="border-sky-200 bg-sky-50/80 text-sky-950">
          <Info className="h-4 w-4 text-sky-600" aria-hidden />
          <AlertTitle className="text-sky-950">
            {t('reports.custom.externalErpTitle')}
          </AlertTitle>
          <AlertDescription className="text-sky-900/90">
            <p>{t('reports.custom.externalErpDescription')}</p>
            <p className="mt-3 flex flex-wrap gap-3">
              <Link
                to="/reports?tab=erp-transfer"
                className="font-medium text-sky-700 underline-offset-2 hover:underline"
              >
                {t('reports.custom.openErpTransfer')}
              </Link>
              <Link
                to="/connections?tab=erp"
                className="font-medium text-sky-700 underline-offset-2 hover:underline"
              >
                {t('reports.custom.openConnections')}
              </Link>
            </p>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div id="report-custom" className="space-y-6">
      <p className="text-sm text-muted-foreground">
        {productAccess.accountingOnly
          ? t('reports.custom.subtitleNative')
          : t('reports.custom.subtitle')}
      </p>

      <CustomReportBuilder
        accountingOnly={productAccess.accountingOnly}
        onSaved={() => setListKey((k) => k + 1)}
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">{t('reports.custom.savedList')}</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setShareReportId('custom');
              setShareOpen(true);
            }}
          >
            <Share2 className="mr-2 h-4 w-4" />
            {t('reports.share.action')}
          </Button>
        </CardHeader>
        <CardContent>
          <SavedReportsList key={listKey} />
        </CardContent>
      </Card>

      {shareReportId ? (
        <ShareReportModal
          open={shareOpen}
          onOpenChange={setShareOpen}
          reportId={shareReportId}
          reportName={t('reports.tabs.custom')}
        />
      ) : null}
    </div>
  );
}
