import type { ReactElement } from 'react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuthStore } from '@/store/auth.store';

import { PartnerCommissionHistoryTab } from './PartnerCommissionHistoryTab';
import { PartnerDashboardTab } from './PartnerDashboardTab';
import { PartnerInviteTab } from './PartnerInviteTab';

export function PartnerPage(): ReactElement {
  const orgType = useAuthStore((s) => s.currentOrg?.type);

  if (orgType !== 'PARTNER') {
    return (
      <div className="rounded-lg border bg-card p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold">Partner değilsiniz</h1>
        <p className="mt-2 text-muted-foreground">
          Bu alan yalnızca partner (ajans) hesapları için kullanılabilir.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-primary">Partner Paneli</h1>
        <p className="text-muted-foreground">
          Müşterilerinizi, davetlerinizi ve komisyonlarınızı buradan yönetin.
        </p>
      </div>

      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="invite">Müşteri Davet</TabsTrigger>
          <TabsTrigger value="commissions">Komisyon Geçmişi</TabsTrigger>
        </TabsList>
        <TabsContent value="dashboard" className="mt-6">
          <PartnerDashboardTab />
        </TabsContent>
        <TabsContent value="invite" className="mt-6">
          <PartnerInviteTab />
        </TabsContent>
        <TabsContent value="commissions" className="mt-6">
          <PartnerCommissionHistoryTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
