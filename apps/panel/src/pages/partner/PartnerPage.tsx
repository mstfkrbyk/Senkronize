import type { ReactElement } from 'react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UpgradePrompt } from '@/components/UpgradePrompt';
import { useAuthStore } from '@/store/auth.store';

import { PartnerCommissionHistoryTab } from './PartnerCommissionHistoryTab';
import { PartnerCommissionReportTab } from './PartnerCommissionReportTab';
import { PartnerDashboardTab } from './PartnerDashboardTab';
import { PartnerOnboardingTab } from './PartnerOnboardingTab';
import { PartnerPerformanceTab } from './PartnerPerformanceTab';
import { PartnerWhiteLabelTab } from './PartnerWhiteLabelTab';

export function PartnerPage(): ReactElement {
  const orgType = useAuthStore((s) => s.currentOrg?.type);
  const plan = useAuthStore((s) => s.currentOrg?.plan);

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

      {plan !== 'KURUMSAL' ? (
        <UpgradePrompt
          feature="Kurumsal partner özellikleri"
          requiredPlan="KURUMSAL"
          currentPlan={plan}
          description="Özel SLA, gelişmiş raporlama ve öncelikli entegrasyon desteği Kurumsal pakette sunulur."
        />
      ) : null}

      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="flex h-auto flex-wrap gap-1">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="onboarding">Müşteri onboarding</TabsTrigger>
          <TabsTrigger value="commission-report">Komisyon raporu</TabsTrigger>
          <TabsTrigger value="commissions">Komisyon geçmişi</TabsTrigger>
          <TabsTrigger value="white-label">Beyaz etiket</TabsTrigger>
          <TabsTrigger value="performance">Performans</TabsTrigger>
        </TabsList>
        <TabsContent value="dashboard" className="mt-6">
          <PartnerDashboardTab />
        </TabsContent>
        <TabsContent value="onboarding" className="mt-6">
          <PartnerOnboardingTab />
        </TabsContent>
        <TabsContent value="commission-report" className="mt-6">
          <PartnerCommissionReportTab />
        </TabsContent>
        <TabsContent value="commissions" className="mt-6">
          <PartnerCommissionHistoryTab />
        </TabsContent>
        <TabsContent value="white-label" className="mt-6">
          <PartnerWhiteLabelTab />
        </TabsContent>
        <TabsContent value="performance" className="mt-6">
          <PartnerPerformanceTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
