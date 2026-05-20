import type { ReactElement } from 'react';
import { NavLink, Outlet, Route, Routes } from 'react-router-dom';

import { UpgradePrompt } from '@/components/UpgradePrompt';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';

import { CommissionPage } from './CommissionPage';
import { PartnerClientsPage } from './PartnerClientsPage';
import { PartnerDashboardPage } from './PartnerDashboardPage';
import { PartnerOnboardingTab } from './PartnerOnboardingTab';

const navItems = [
  { to: '/partner', end: true, label: 'Dashboard' },
  { to: '/partner/clients', end: false, label: 'Müşteriler' },
  { to: '/partner/commission', end: false, label: 'Komisyon' },
  { to: '/partner/onboarding', end: false, label: 'Onboarding' },
] as const;

function PartnerNav(): ReactElement {
  return (
    <nav className="flex flex-wrap gap-1 rounded-lg border bg-muted/30 p-1">
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              isActive
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

function PartnerIndex(): ReactElement {
  return <PartnerDashboardPage />;
}

function PartnerOutletLayout(): ReactElement {
  return <Outlet />;
}

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

      <PartnerNav />

      <Routes>
        <Route element={<PartnerOutletLayout />}>
          <Route index element={<PartnerIndex />} />
          <Route path="clients" element={<PartnerClientsPage />} />
          <Route path="commission" element={<CommissionPage />} />
          <Route path="onboarding" element={<PartnerOnboardingTab />} />
        </Route>
      </Routes>
    </div>
  );
}
