const PRISMA_ACTION_LABELS: Record<string, string> = {
  create: 'oluşturuldu',
  update: 'güncellendi',
  upsert: 'kaydedildi',
  delete: 'silindi',
  createMany: 'toplu oluşturuldu',
  updateMany: 'toplu güncellendi',
  deleteMany: 'toplu silindi',
};

const AUDIT_LOG_ACTION_LABELS: Record<string, string> = {
  USER_REGISTERED: 'Kullanıcı kaydı',
  USER_LOGIN: 'Giriş',
  USER_LOGOUT: 'Çıkış',
  IMPERSONATION_START: 'Hesap erişimi başladı',
  IMPERSONATION_END: 'Hesap erişimi bitti',
  SUBSCRIPTION_ACTIVATED: 'Abonelik aktifleşti',
  PLAN_CHANGED: 'Plan değiştirildi',
  DATA_EXPORT_REQUESTED: 'Veri dışa aktarma talebi',

  'partner.impersonation_start': 'Partner müşteri hesabına geçti',
  'partner.impersonation_end': 'Partner hesap erişimi sonlandı',
  'partner.payout_request': 'Partner ödeme talebi',
  'admin.partner_payout_approve': 'Partner ödeme talebi onayı',
  'admin.partner_payout_reject': 'Partner ödeme talebi reddi',

  'admin.impersonation_start': 'Admin müşteri hesabına geçti',
  'admin.organization_suspended': 'Organizasyon askıya alındı',
  'admin.organization_unsuspended': 'Organizasyon askıdan çıkarıldı',
  'admin.organization_deleted': 'Organizasyon silindi',
  'admin.organization_product_lines_changed': 'Ürün hatları güncellendi',
  'admin.organization_accounting_mode_changed': 'Muhasebe modu değiştirildi',
  'admin.organization_partner_assigned': 'Partner atandı',
  'admin.organization_partner_removed': 'Partner kaldırıldı',
  'admin.organization_extra_erp_slot_granted': 'Ek ERP slotu tanımlandı',
  'admin.subscription_plan_changed': 'Abonelik planı değiştirildi (admin)',
  'admin.subscription_updated': 'Abonelik güncellendi (admin)',
  'admin.user_role_changed': 'Kullanıcı rolü değiştirildi (admin)',
  'admin.user_suspended': 'Kullanıcı askıya alındı',
  'admin.user_unsuspended': 'Kullanıcı askıdan çıkarıldı',
  'admin.user_password_reset': 'Kullanıcı şifresi sıfırlandı',
  'admin.user_sessions_revoked': 'Kullanıcı oturumları sonlandırıldı',
  'admin.ip_block_remove': 'IP engeli kaldırıldı',
  'admin.platform_circuit_reset': 'Platform devre kesici sıfırlandı',
  'admin.partner_commission_rate_update': 'Partner komisyon oranı güncellendi',
  'admin.partner_link_approve': 'Partner bağlantısı onaylandı',
  'admin.partner_link_reject': 'Partner bağlantısı reddedildi',

  'auth.login_failed': 'Başarısız giriş denemesi',
  'auth.password_changed': 'Şifre değiştirildi',
  'auth.two_factor_enabled': 'İki adımlı doğrulama etkinleştirildi',
  'auth.two_factor_disabled': 'İki adımlı doğrulama devre dışı',
  'auth.two_factor_backup_regenerated': '2FA yedek kodları yenilendi',
  'auth.two_factor_backup_used': '2FA yedek kodu kullanıldı',

  'users.role_changed': 'Kullanıcı rolü değiştirildi',
  'users.removed_from_org': 'Kullanıcı organizasyondan çıkarıldı',
  'users.ownership_transferred': 'Organizasyon sahipliği devredildi',

  'subscription.product_line_added': 'Ürün hattı eklendi',
  'subscription.plan_changed': 'Abonelik planı değiştirildi',
  'subscription.cancel_requested': 'Abonelik iptal talebi',
  'subscription.reactivated': 'Abonelik yeniden aktifleştirildi',
  'subscription.payment_failed': 'Ödeme başarısız',
  'subscription.plan_upgrade_requested': 'Plan yükseltme talebi',
  'subscription.plan_activated': 'Abonelik aktifleşti',
  'subscription.trial_extended': 'Deneme süresi uzatıldı',

  'email.subscription_expiring_7d': 'Abonelik bitiş uyarısı (7 gün)',

  'erp.invoice_created': 'ERP faturası oluşturuldu',

  'queue.job_failed': 'Kuyruk işi başarısız',

  'sync_completed': 'Senkronizasyon tamamlandı',
  'sync_failed': 'Senkronizasyon hatası',

  'security.suspect_bulk_night': 'Şüpheli toplu işlem (gece)',
};

const AUDIT_LOG_RESOURCE_LABELS: Record<string, string> = {
  User: 'Kullanıcı',
  Organization: 'Organizasyon',
  Subscription: 'Abonelik',
  ApiKey: 'API anahtarı',
  MarketplaceConnection: 'Pazaryeri bağlantısı',
  ErpConnection: 'ERP bağlantısı',
  EcommerceConnection: 'E-ticaret bağlantısı',
  CargoConnection: 'Kargo bağlantısı',
  Invoice: 'Fatura',
  Order: 'Sipariş',
  Listing: 'Listeleme',
  Product: 'Ürün',
  BullJob: 'Arka plan işi',
  Sync: 'Senkronizasyon',
};

function formatPrismaMiddlewareAction(action: string): string | null {
  const dot = action.indexOf('.');
  if (dot <= 0) {
    return null;
  }
  const model = action.slice(0, dot);
  const prismaAction = action.slice(dot + 1);
  const resourceLabel = formatAuditLogResource(model);
  const verb = PRISMA_ACTION_LABELS[prismaAction];
  if (verb) {
    return `${resourceLabel} ${verb}`;
  }
  return `${resourceLabel}: ${humanizeSegment(prismaAction)}`;
}

function humanizeSegment(segment: string): string {
  return segment
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase();
}

function humanizeActionFallback(action: string): string {
  if (action.startsWith('sync_')) {
    const detail = action.replace(/^sync_/, '').replace(/_/g, ' ');
    return `Senkronizasyon: ${detail}`;
  }
  const parts = action.split('.');
  if (parts.length >= 2) {
    const [domain, ...rest] = parts;
    const domainLabels: Record<string, string> = {
      auth: 'Kimlik',
      users: 'Kullanıcı',
      user: 'Kullanıcı',
      email: 'E-posta',
      partner: 'Partner',
      admin: 'Yönetim',
      subscription: 'Abonelik',
      erp: 'ERP',
      queue: 'Kuyruk',
      security: 'Güvenlik',
    };
    const domainLabel = domainLabels[domain] ?? domain;
    const detail = rest.map(humanizeSegment).join(' · ');
    return `${domainLabel}: ${detail}`;
  }
  return action.replace(/_/g, ' ').replace(/\./g, ' · ');
}

export function formatAuditLogAction(action: string | null | undefined): string {
  if (action == null || action === '') {
    return '—';
  }
  const exact = AUDIT_LOG_ACTION_LABELS[action];
  if (exact) {
    return exact;
  }
  const prisma = formatPrismaMiddlewareAction(action);
  if (prisma) {
    return prisma;
  }
  return humanizeActionFallback(action);
}

export function formatAuditLogResource(resource: string | null | undefined): string {
  if (resource == null || resource === '') {
    return '—';
  }
  return (
    AUDIT_LOG_RESOURCE_LABELS[resource] ??
    resource.replace(/([a-z])([A-Z])/g, '$1 $2')
  );
}

export function formatAuditLogResourceDisplay(
  resource: string | null | undefined,
  resourceId?: string | null,
): string {
  const label = formatAuditLogResource(resource);
  if (!resourceId?.trim()) {
    return label;
  }
  const id = resourceId.trim();
  const shortId = id.length > 12 ? `${id.slice(0, 8)}…` : id;
  return `${label} · ${shortId}`;
}
