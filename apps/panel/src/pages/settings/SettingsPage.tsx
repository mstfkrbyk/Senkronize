import type { ReactElement, ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { isSettingsTabId, type SettingsTabId } from './settings-tabs.config';
import { ApiKeysTab } from './tabs/ApiKeysTab';
import { CurrencyTab } from './tabs/CurrencyTab';
import { ErpSyncSettingsTab } from './tabs/ErpSyncSettingsTab';
import { InvoiceNumberingTab } from './tabs/InvoiceNumberingTab';
import { NotificationsTab } from './tabs/NotificationsTab';
import { SecurityTab } from './tabs/SecurityTab';
import { ProfileTab } from './tabs/ProfileTab';
import { SubscriptionPage } from './SubscriptionPage';
import { TeamMembersTab } from './tabs/TeamMembersTab';
import { WebhooksTab } from './tabs/WebhooksTab';
import { useSettingsTabGroups } from './useSettingsTabGroups';

function SettingsTabPanel({
  tabId,
  children,
}: {
  tabId: SettingsTabId;
  children: ReactNode;
}): ReactElement {
  return (
    <TabsContent value={tabId} className="mt-6">
      {children}
    </TabsContent>
  );
}

export function SettingsPage(): ReactElement {
  const { t } = useTranslation();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const tabParam = searchParams.get('tab');
  const pathPreferred = location.pathname.includes('/settings/subscription')
    ? 'subscription'
    : tabParam;

  const { sections, visibleTabIds, defaultTab, accountingModeLoading } =
    useSettingsTabGroups(pathPreferred);

  const [activeTab, setActiveTab] = useState<SettingsTabId>(defaultTab);

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  const handleTabChange = (value: string): void => {
    if (!isSettingsTabId(value) || !visibleTabIds.includes(value)) {
      return;
    }
    setActiveTab(value);
    const next = new URLSearchParams(searchParams);
    next.set('tab', value);
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-primary">
          {t('settings.title')}
        </h1>
        <p className="text-muted-foreground">{t('settings.subtitle')}</p>
      </div>

      {accountingModeLoading ? (
        <Skeleton className="h-10 w-full max-w-3xl" />
      ) : (
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <div className="space-y-5">
            {sections.map((section) => (
              <div key={section.id} className="space-y-2">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t(section.labelKey)}
                </h2>
                <TabsList className="flex h-auto flex-wrap justify-start gap-1 bg-transparent p-0">
                  {section.tabs.map((tab) => (
                    <TabsTrigger
                      key={tab.id}
                      value={tab.id}
                      className="data-[state=active]:bg-muted"
                    >
                      {t(tab.labelKey)}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
            ))}
          </div>

          <SettingsTabPanel tabId="profile">
            <>
              <p className="mb-4 text-sm text-muted-foreground">
                {t('settings.profileAdvancedHint')}{' '}
                <Link
                  to="/settings/profile"
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  {t('settings.profileAdvancedLink')}
                </Link>
              </p>
              <ProfileTab />
            </>
          </SettingsTabPanel>

          <SettingsTabPanel tabId="security">
            <SecurityTab />
          </SettingsTabPanel>

          <SettingsTabPanel tabId="notifications">
            <NotificationsTab />
          </SettingsTabPanel>

          <SettingsTabPanel tabId="subscription">
            <SubscriptionPage />
          </SettingsTabPanel>

          <SettingsTabPanel tabId="team">
            <TeamMembersTab />
          </SettingsTabPanel>

          {visibleTabIds.includes('api-keys') ? (
            <SettingsTabPanel tabId="api-keys">
              <ApiKeysTab />
            </SettingsTabPanel>
          ) : null}

          {visibleTabIds.includes('webhooks') ? (
            <SettingsTabPanel tabId="webhooks">
              <WebhooksTab />
            </SettingsTabPanel>
          ) : null}

          {visibleTabIds.includes('currency') ? (
            <SettingsTabPanel tabId="currency">
              <CurrencyTab />
            </SettingsTabPanel>
          ) : null}

          {visibleTabIds.includes('invoice-numbering') ? (
            <SettingsTabPanel tabId="invoice-numbering">
              <InvoiceNumberingTab />
            </SettingsTabPanel>
          ) : null}

          {visibleTabIds.includes('erp-sync') ? (
            <SettingsTabPanel tabId="erp-sync">
              <ErpSyncSettingsTab />
            </SettingsTabPanel>
          ) : null}
        </Tabs>
      )}
    </div>
  );
}
