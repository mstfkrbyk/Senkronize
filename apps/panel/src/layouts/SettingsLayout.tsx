import type { ReactElement } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
import { useAccountingMode } from '@/hooks/useAccountingMode';
import { hasOrgProductLine } from '@/lib/org-products';

interface SettingsNavItem {
  to: string;
  labelKey: string;
}

interface SettingsNavGroup {
  id: string;
  labelKey: string;
  items: SettingsNavItem[];
}

export function SettingsLayout(): ReactElement {
  const { t } = useTranslation();
  const orgProducts = useAuthStore((s) => s.currentOrg?.orgProducts);
  const orgType = useAuthStore((s) => s.currentOrg?.type);
  const { mode } = useAccountingMode();

  const hasIntegration = hasOrgProductLine(orgProducts, 'INTEGRATION');
  const hasAccounting = hasOrgProductLine(orgProducts, 'ACCOUNTING');
  const isNative = mode === 'NATIVE';
  const isExternalErp = mode === 'EXTERNAL_ERP';
  const isDirect = orgType === 'DIRECT';

  const groups: SettingsNavGroup[] = [
    {
      id: 'account',
      labelKey: 'settings.layout.groups.account',
      items: [
        { to: '/settings/profile', labelKey: 'settings.tabs.profile' },
        { to: '/settings/security', labelKey: 'settings.tabs.security' },
        { to: '/settings/notifications', labelKey: 'settings.tabs.notifications' },
        { to: '/settings/appearance', labelKey: 'settings.tabs.appearance' },
      ],
    },
    {
      id: 'organization',
      labelKey: 'settings.layout.groups.organization',
      items: [
        { to: '/settings/organization', labelKey: 'settings.tabs.organization' },
        { to: '/settings/team', labelKey: 'settings.tabs.teamMembers' },
        { to: '/settings/subscription', labelKey: 'settings.tabs.subscription' },
        ...(isDirect
          ? [{ to: '/settings/partners', labelKey: 'settings.tabs.partners' }]
          : []),
      ],
    },
    ...(hasIntegration
      ? [
          {
            id: 'integration',
            labelKey: 'settings.layout.groups.integration',
            items: [
              { to: '/settings/api-keys', labelKey: 'settings.tabs.apiKeys' },
              { to: '/settings/webhooks', labelKey: 'settings.tabs.webhooks' },
              { to: '/settings/product-matching', labelKey: 'settings.tabs.productMatching' },
            ],
          },
        ]
      : isExternalErp && (hasAccounting || hasIntegration)
        ? [
            {
              id: 'integration',
              labelKey: 'settings.layout.groups.integration',
              items: [
                { to: '/settings/product-matching', labelKey: 'settings.tabs.productMatching' },
              ],
            },
          ]
        : []),
    ...(hasAccounting
      ? [
          {
            id: 'accounting',
            labelKey: 'settings.layout.groups.accounting',
            items: [
              {
                to: '/settings/accounting-mode',
                labelKey: 'settings.tabs.accountingMode',
              },
              ...(isNative
                ? [
                    { to: '/settings/currency', labelKey: 'settings.tabs.currency' },
                    {
                      to: '/settings/invoice-numbering',
                      labelKey: 'settings.tabs.invoiceNumbering',
                    },
                  ]
                : []),
            ],
          },
        ]
      : []),
    ...(isExternalErp && (hasAccounting || hasIntegration)
      ? [
          {
            id: 'erp',
            labelKey: 'settings.layout.groups.erp',
            items: [
              { to: '/settings/erp-sync', labelKey: 'settings.tabs.erpSync' },
            ],
          },
        ]
      : []),
  ];

  const navLinkClass = (isActive: boolean): string =>
    cn(
      'flex items-center rounded-md px-3 py-2 text-sm transition-colors',
      isActive
        ? 'border border-primary/20 bg-primary/10 font-medium text-primary shadow-sm'
        : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
    );

  const sidebarContent = (
    <nav className="space-y-6">
      {groups.map((group) => (
        <div key={group.id}>
          <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
            {t(group.labelKey)}
          </p>
          <div className="space-y-0.5">
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end
                className={({ isActive }) => navLinkClass(isActive)}
              >
                {t(item.labelKey)}
              </NavLink>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="flex min-h-full flex-col gap-6 lg:flex-row lg:gap-8">
      <aside className="hidden w-52 shrink-0 lg:block">
        <div className="sticky top-0 rounded-lg border border-border bg-card p-3 shadow-sm">
          {sidebarContent}
        </div>
      </aside>
      <aside className="lg:hidden">
        <nav className="flex gap-1 overflow-x-auto rounded-lg border border-border bg-card p-2 shadow-sm">
          {groups.flatMap((g) =>
            g.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end
                className={({ isActive }) =>
                  cn(
                    'shrink-0 rounded-md px-3 py-2 text-sm transition-colors whitespace-nowrap',
                    isActive
                      ? 'border border-primary/20 bg-primary/10 font-medium text-primary shadow-sm'
                      : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                  )
                }
              >
                {t(item.labelKey)}
              </NavLink>
            )),
          )}
        </nav>
      </aside>
      <div className="min-w-0 flex-1">
        <div className="px-1">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
