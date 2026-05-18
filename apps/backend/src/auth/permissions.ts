import { UserRole } from '@prisma/client';

export enum Permission {
  ORDERS_VIEW = 'orders:view',
  ORDERS_EXPORT = 'orders:export',
  PRODUCTS_VIEW = 'products:view',
  PRODUCTS_EDIT = 'products:edit',
  PRICING_VIEW = 'pricing:view',
  PRICING_EDIT = 'pricing:edit',
  CONNECTIONS_VIEW = 'connections:view',
  CONNECTIONS_EDIT = 'connections:edit',
  REPORTS_VIEW = 'reports:view',
  SETTINGS_VIEW = 'settings:view',
  SETTINGS_BILLING = 'settings:billing',
  USERS_VIEW = 'users:view',
  USERS_MANAGE = 'users:manage',
}

const adminPermissions: Permission[] = [
  Permission.ORDERS_VIEW,
  Permission.ORDERS_EXPORT,
  Permission.PRODUCTS_VIEW,
  Permission.PRODUCTS_EDIT,
  Permission.PRICING_VIEW,
  Permission.PRICING_EDIT,
  Permission.CONNECTIONS_VIEW,
  Permission.CONNECTIONS_EDIT,
  Permission.REPORTS_VIEW,
  Permission.SETTINGS_VIEW,
  Permission.USERS_VIEW,
  Permission.USERS_MANAGE,
];

/** Üye (standart çalışan) — eski “MEMBER” matrisi; şemada UserRole.MANAGER ile eşlenir. */
const memberPermissions: Permission[] = [
  Permission.ORDERS_VIEW,
  Permission.PRODUCTS_VIEW,
  Permission.PRICING_VIEW,
  Permission.CONNECTIONS_VIEW,
  Permission.REPORTS_VIEW,
  Permission.SETTINGS_VIEW,
  Permission.USERS_VIEW,
];

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.SUPER_ADMIN]: Object.values(Permission),
  [UserRole.OWNER]: Object.values(Permission),
  [UserRole.ADMIN]: adminPermissions,
  [UserRole.MANAGER]: memberPermissions,
  [UserRole.VIEWER]: [
    Permission.ORDERS_VIEW,
    Permission.PRODUCTS_VIEW,
    Permission.PRICING_VIEW,
    Permission.CONNECTIONS_VIEW,
    Permission.REPORTS_VIEW,
    Permission.SETTINGS_VIEW,
    Permission.USERS_VIEW,
  ],
};
