import type { ReactElement } from 'react';
import type { LucideIcon } from 'lucide-react';
import { BarChart3, Building2, CreditCard, LayoutDashboard } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AdminNavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

const ADMIN_NAV: AdminNavItem[] = [
  { to: '/admin', label: 'Platform İstatistikleri', icon: LayoutDashboard, end: true },
  { to: '/admin/organizations', label: 'Organizasyonlar', icon: Building2 },
  { to: '/admin/subscriptions', label: 'Abonelikler', icon: CreditCard },
];

export function AdminLayout(): ReactElement {
  return (
    <div className="flex min-h-svh bg-slate-100">
      <aside className="flex w-56 shrink-0 flex-col border-r border-sidebar-border bg-slate-900 text-sidebar-foreground">
        <div className="border-b border-white/10 p-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="size-5 text-sky-400" aria-hidden />
            <span className="font-semibold tracking-tight">Super Admin</span>
          </div>
          <Badge className="mt-2 border-0 bg-red-600 text-white hover:bg-red-600">
            Platform
          </Badge>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-2">
          {ADMIN_NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end}>
              {({ isActive }) => (
                <span
                  className={cn(
                    'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                    isActive
                      ? 'bg-white/10 text-white'
                      : 'text-slate-300 hover:bg-white/5 hover:text-white',
                  )}
                >
                  <Icon className="size-4 shrink-0" aria-hidden />
                  {label}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-white/10 p-2">
          <Button
            asChild
            variant="ghost"
            className="w-full justify-start text-slate-300 hover:bg-white/5 hover:text-white"
          >
            <NavLink to="/dashboard">← Panele dön</NavLink>
          </Button>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-slate-200 bg-white px-6 py-4">
          <h1 className="text-xl font-semibold text-slate-900">Super Admin Panel</h1>
          <p className="text-sm text-muted-foreground">
            Platform düzeyinde organizasyon ve abonelik yönetimi
          </p>
        </header>
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
