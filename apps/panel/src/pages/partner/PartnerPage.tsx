import type { ReactElement } from 'react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuthStore } from '@/store/auth.store';

import { ClientsTab } from './ClientsTab';
import { CommissionTab } from './CommissionTab';

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
          Müşterilerinizi ve komisyonlarınızı buradan yönetin.
        </p>
      </div>

      <Tabs defaultValue="clients" className="w-full">
        <TabsList>
          <TabsTrigger value="clients">Müşteriler</TabsTrigger>
          <TabsTrigger value="commission">Komisyon</TabsTrigger>
        </TabsList>
        <TabsContent value="clients" className="mt-6">
          <ClientsTab />
        </TabsContent>
        <TabsContent value="commission" className="mt-6">
          <CommissionTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
