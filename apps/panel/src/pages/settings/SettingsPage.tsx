import type { ReactElement } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuthStore } from '@/store/auth.store';

import { AppearanceTab } from './tabs/AppearanceTab';
import { ApiKeysTab } from './tabs/ApiKeysTab';
import { CurrencyTab } from './tabs/CurrencyTab';
import { NotificationsTab } from './tabs/NotificationsTab';
import { OrganizationTab } from './tabs/OrganizationTab';
import { PartnersTab } from './tabs/PartnersTab';
import { SecurityTab } from './tabs/SecurityTab';
import { ProfileTab } from './tabs/ProfileTab';
import { SubscriptionPage } from './SubscriptionPage';
import { TeamTab } from './tabs/TeamTab';
import { WebhooksTab } from './tabs/WebhooksTab';

const SETTINGS_TAB_IDS = [
  'profile',
  'appearance',
  'organization',
  'currency',
  'team',
  'subscription',
  'notifications',
  'security',
  'api-keys',
  'webhooks',
  'partners',
] as const;

export function SettingsPage(): ReactElement {
  const { t } = useTranslation();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const orgType = useAuthStore((s) => s.currentOrg?.type);
  const showPartnersTab = orgType !== 'PARTNER';

  const tabParam = searchParams.get('tab');
  const defaultTab = location.pathname.includes('/settings/subscription')
    ? 'subscription'
    : tabParam &&
        (SETTINGS_TAB_IDS as readonly string[]).includes(tabParam)
      ? tabParam
      : 'profile';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-primary">{t('settings.title')}</h1>
        <p className="text-muted-foreground">{t('settings.subtitle')}</p>
      </div>

      <Tabs key={defaultTab} defaultValue={defaultTab} className="w-full">
        <TabsList className="flex h-auto flex-wrap justify-start gap-1">
          <TabsTrigger value="profile">{t('settings.profile')}</TabsTrigger>
          <TabsTrigger value="appearance">{t('settings.appearance')}</TabsTrigger>
          <TabsTrigger value="organization">{t('settings.organization')}</TabsTrigger>
          <TabsTrigger value="currency">{t('settings.currency')}</TabsTrigger>
          <TabsTrigger value="team">{t('settings.team')}</TabsTrigger>
          <TabsTrigger value="subscription">{t('settings.subscription')}</TabsTrigger>
          <TabsTrigger value="notifications">{t('settings.notifications')}</TabsTrigger>
          <TabsTrigger value="security">{t('settings.security')}</TabsTrigger>
          <TabsTrigger value="api-keys">{t('settings.apiKeys')}</TabsTrigger>
          <TabsTrigger value="webhooks">{t('settings.webhooks')}</TabsTrigger>
          {showPartnersTab ? (
            <TabsTrigger value="partners">{t('settings.partners')}</TabsTrigger>
          ) : null}
        </TabsList>
        <TabsContent value="profile" className="mt-6">
          <p className="mb-4 text-sm text-muted-foreground">
            Gelişmiş profil ve oturum yönetimi için{' '}
            <Link to="/settings/profile" className="font-medium text-primary underline-offset-4 hover:underline">
              profil sayfasına
            </Link>{' '}
            gidin.
          </p>
          <ProfileTab />
        </TabsContent>
        <TabsContent value="appearance" className="mt-6">
          <AppearanceTab />
        </TabsContent>
        <TabsContent value="organization" className="mt-6">
          <OrganizationTab />
        </TabsContent>
        <TabsContent value="currency" className="mt-6">
          <CurrencyTab />
        </TabsContent>
        <TabsContent value="team" className="mt-6">
          <TeamTab />
        </TabsContent>
        <TabsContent value="subscription" className="mt-6">
          <SubscriptionPage />
        </TabsContent>
        <TabsContent value="notifications" className="mt-6">
          <NotificationsTab />
        </TabsContent>
        <TabsContent value="security" className="mt-6">
          <SecurityTab />
        </TabsContent>
        <TabsContent value="api-keys" className="mt-6">
          <ApiKeysTab />
        </TabsContent>
        <TabsContent value="webhooks" className="mt-6">
          <WebhooksTab />
        </TabsContent>
        {showPartnersTab ? (
          <TabsContent value="partners" className="mt-6">
            <PartnersTab />
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}
