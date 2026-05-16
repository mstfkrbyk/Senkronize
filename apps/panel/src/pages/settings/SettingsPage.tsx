import type { ReactElement } from 'react';
import { useLocation } from 'react-router-dom';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { NotificationsTab } from './tabs/NotificationsTab';
import { OrganizationTab } from './tabs/OrganizationTab';
import { ProfileTab } from './tabs/ProfileTab';
import { SubscriptionTab } from './tabs/SubscriptionTab';
import { TeamTab } from './tabs/TeamTab';

export function SettingsPage(): ReactElement {
  const location = useLocation();
  const defaultTab = location.pathname.includes('/settings/subscription')
    ? 'subscription'
    : 'profile';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-primary">Ayarlar</h1>
        <p className="text-muted-foreground">
          Hesap, firma, ekip ve abonelik ayarlarınızı yönetin.
        </p>
      </div>

      <Tabs key={defaultTab} defaultValue={defaultTab} className="w-full">
        <TabsList className="flex h-auto flex-wrap justify-start gap-1">
          <TabsTrigger value="profile">Profil</TabsTrigger>
          <TabsTrigger value="organization">Firma</TabsTrigger>
          <TabsTrigger value="team">Ekip</TabsTrigger>
          <TabsTrigger value="subscription">Abonelik</TabsTrigger>
          <TabsTrigger value="notifications">Bildirimler</TabsTrigger>
        </TabsList>
        <TabsContent value="profile" className="mt-6">
          <ProfileTab />
        </TabsContent>
        <TabsContent value="organization" className="mt-6">
          <OrganizationTab />
        </TabsContent>
        <TabsContent value="team" className="mt-6">
          <TeamTab />
        </TabsContent>
        <TabsContent value="subscription" className="mt-6">
          <SubscriptionTab />
        </TabsContent>
        <TabsContent value="notifications" className="mt-6">
          <NotificationsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
