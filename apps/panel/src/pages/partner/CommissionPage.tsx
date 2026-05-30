import type { ReactElement } from 'react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';

import { PartnerCommissionHistoryTab } from './PartnerCommissionHistoryTab';
import { PartnerCommissionOverviewTab } from './PartnerCommissionOverviewTab';
import { PartnerCommissionPayoutRequestsTab } from './PartnerCommissionPayoutRequestsTab';
import { PartnerCommissionReportTab } from './PartnerCommissionReportTab';
import { PartnerPageHeader } from './PartnerPageHeader';
import {
  type CommissionTab,
  PARTNER_COMMISSION_REPORT_PATH,
  partnerCommissionTabPath,
} from './partner-commission-routes';
import { usePartnerQueriesEnabled } from './hooks/usePartner';

export type { CommissionTab };

const TAB_VALUES: CommissionTab[] = ['ozet', 'rapor', 'gecmis', 'talepler'];

function parseTab(value: string | null): CommissionTab | null {
  if (value && TAB_VALUES.includes(value as CommissionTab)) {
    return value as CommissionTab;
  }
  return null;
}

interface Props {
  /** `/partner/commission-report` rotası için varsayılan sekme */
  initialTab?: CommissionTab;
}

export function CommissionPage({ initialTab = 'ozet' }: Props): ReactElement {
  const { t } = useTranslation();
  const { isPending: authPending } = useAuth();
  const partnerQueriesEnabled = usePartnerQueriesEnabled();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const routeDefaultTab: CommissionTab =
    location.pathname === PARTNER_COMMISSION_REPORT_PATH ? 'rapor' : initialTab;
  const tabParam = searchParams.get('tab');
  const activeTab = parseTab(tabParam) ?? routeDefaultTab;

  useEffect(() => {
    const expectedPath = partnerCommissionTabPath(activeTab);
    const next = new URLSearchParams(searchParams);
    next.set('tab', activeTab);
    const needsPath = location.pathname !== expectedPath;
    const needsTab = tabParam !== activeTab;
    if (!needsPath && !needsTab) {
      return;
    }
    if (needsPath) {
      navigate(
        { pathname: expectedPath, search: `?${next.toString()}` },
        { replace: true },
      );
      return;
    }
    setSearchParams(next, { replace: true });
  }, [
    activeTab,
    tabParam,
    searchParams,
    setSearchParams,
    location.pathname,
    navigate,
  ]);

  const pageHeader = (
    <PartnerPageHeader
      title={t('partner.pages.commission.title')}
      description={t('partner.pages.commission.description')}
    />
  );

  if (authPending) {
    return (
      <div className="space-y-6">
        {pageHeader}
        <p className="text-sm text-muted-foreground" role="status">
          {t('partner.pages.commission.authPending')}
        </p>
      </div>
    );
  }

  if (!partnerQueriesEnabled) {
    return (
      <div className="space-y-6">
        {pageHeader}
        <p className="text-sm text-muted-foreground">
          {t('partner.pages.commission.partnerOnly')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {pageHeader}

      <Card>
        <CardContent className="pt-6">
          <Tabs
            value={activeTab}
            onValueChange={(value) => {
              const tab = value as CommissionTab;
              const next = new URLSearchParams(searchParams);
              next.set('tab', tab);
              const path = partnerCommissionTabPath(tab);
              if (location.pathname !== path) {
                navigate({ pathname: path, search: `?${next.toString()}` }, { replace: true });
                return;
              }
              setSearchParams(next, { replace: true });
            }}
          >
            <TabsList className="flex h-auto flex-wrap gap-1">
              <TabsTrigger value="ozet">{t('partner.pages.commission.tabs.overview')}</TabsTrigger>
              <TabsTrigger value="rapor">{t('partner.pages.commission.tabs.report')}</TabsTrigger>
              <TabsTrigger value="gecmis">{t('partner.pages.commission.tabs.history')}</TabsTrigger>
              <TabsTrigger value="talepler">
                {t('partner.pages.commission.tabs.payoutRequests')}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="ozet" className="mt-6">
              <PartnerCommissionOverviewTab />
            </TabsContent>
            <TabsContent value="rapor" className="mt-6">
              <PartnerCommissionReportTab />
            </TabsContent>
            <TabsContent value="gecmis" className="mt-6">
              <PartnerCommissionHistoryTab />
            </TabsContent>
            <TabsContent value="talepler" className="mt-6">
              <PartnerCommissionPayoutRequestsTab />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
