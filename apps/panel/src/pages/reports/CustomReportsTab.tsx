import type { ReactElement } from 'react';
import { useState } from 'react';
import { Plus, Share2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { CustomReportWizard } from './CustomReportWizard';
import { SavedReportsList } from './SavedReportsList';
import { ShareReportModal } from './ShareReportModal';

export function CustomReportsTab(): ReactElement {
  const { t } = useTranslation();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareReportId, setShareReportId] = useState<string | null>(null);
  const [listKey, setListKey] = useState(0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{t('reports.custom.subtitle')}</p>
        <Button type="button" onClick={() => setWizardOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t('reports.custom.createNew')}
        </Button>
      </div>

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

      <CustomReportWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onSaved={() => setListKey((k) => k + 1)}
      />

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
