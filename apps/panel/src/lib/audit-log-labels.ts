import type { AuditLogEntry } from '@/types/audit-log';

const PLAN_LABELS: Record<string, string> = {
  BASLANGIC: 'Başlangıç',
  GELISIM: 'Gelişim',
  PRO: 'Pro',
  KURUMSAL: 'Kurumsal',
};

const PRODUCT_LINE_LABELS: Record<string, string> = {
  INTEGRATION: 'Entegrasyon',
  ACCOUNTING: 'Muhasebe',
};

const PRISMA_ACTION_LABELS: Record<string, string> = {
  create: 'oluşturuldu',
  update: 'güncellendi',
  upsert: 'kaydedildi',
  delete: 'silindi',
  createMany: 'toplu oluşturuldu',
  updateMany: 'toplu güncellendi',
  deleteMany: 'toplu silindi',
};

const SYNC_QUEUE_JOB_LABELS: Record<string, string> = {
  'pull-orders': 'Sipariş çekme',
  'pull-listings': 'Listeleme çekme',
  'pull-returns': 'İade çekme',
  'push-stock': 'Stok gönderme',
  'push-price': 'Fiyat gönderme',
  'push-return-action': 'İade işlemi gönderme',
  'push-order-cancel': 'Sipariş iptali gönderme',
};

/** Bilinen denetim eylemleri → Türkçe etiket */
export const AUDIT_LOG_ACTION_LABELS: Record<string, string> = {
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

export const AUDIT_LOG_RESOURCE_LABELS: Record<string, string> = {
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

const METADATA_FIELD_LABELS: Record<string, string> = {
  platform: 'Platform',
  jobName: 'İş',
  queue: 'Kuyruk',
  reason: 'Gerekçe',
  previousPlan: 'Önceki plan',
  newPlan: 'Yeni plan',
  previousRole: 'Önceki rol',
  newRole: 'Yeni rol',
  newOwnerId: 'Yeni sahip',
  partnerOrgId: 'Partner org.',
  clientOrgId: 'Müşteri org.',
  orderId: 'Sipariş',
  erpType: 'ERP',
  daysLeft: 'Kalan gün',
  orderCount: 'Sipariş sayısı',
  listingCount: 'Listeleme sayısı',
  userCount: 'Kullanıcı sayısı',
  paytrOrderId: 'PayTR sipariş',
  productLine: 'Ürün hattı',
  productLines: 'Ürün hatları',
  previousLines: 'Önceki hatlar',
  effectiveUntil: 'Geçerlilik',
  rate: 'Oran',
  note: 'Not',
  remainingCodes: 'Kalan yedek kod',
  attemptsMade: 'Deneme',
  maxAttempts: 'Maks. deneme',
  failedReason: 'Hata',
  organizationId: 'Organizasyon',
  prismaModel: 'Kayıt türü',
  prismaAction: 'İşlem',
};

const METADATA_SUMMARY_ORDER = [
  'platform',
  'jobName',
  'queue',
  'previousPlan',
  'newPlan',
  'productLine',
  'productLines',
  'previousRole',
  'newRole',
  'reason',
  'orderId',
  'erpType',
  'daysLeft',
  'orderCount',
  'listingCount',
  'userCount',
  'failedReason',
  'rate',
  'note',
  'partnerOrgId',
  'clientOrgId',
  'effectiveUntil',
  'paytrOrderId',
  'remainingCodes',
  'prismaModel',
  'prismaAction',
] as const;

const METADATA_SKIP_KEYS = new Set([
  'source',
  'stub',
  'args',
  'previousLines',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function formatPlanValue(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  return PLAN_LABELS[value] ?? value;
}

function formatProductLineValue(value: unknown): string | null {
  if (typeof value === 'string') {
    return PRODUCT_LINE_LABELS[value] ?? value;
  }
  if (Array.isArray(value)) {
    const parts = value
      .filter((v): v is string => typeof v === 'string')
      .map((v) => PRODUCT_LINE_LABELS[v] ?? v);
    return parts.length > 0 ? parts.join(', ') : null;
  }
  return null;
}

function formatMetadataScalar(key: string, value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (key === 'previousPlan' || key === 'newPlan' || key === 'plan') {
    return formatPlanValue(value);
  }
  if (
    key === 'productLine' ||
    key === 'productLines' ||
    key === 'previousLines'
  ) {
    return formatProductLineValue(value);
  }
  if (key === 'jobName' && typeof value === 'string') {
    return SYNC_QUEUE_JOB_LABELS[value] ?? value;
  }
  if (key === 'prismaModel' && typeof value === 'string') {
    return formatAuditLogResource(value);
  }
  if (key === 'prismaAction' && typeof value === 'string') {
    return PRISMA_ACTION_LABELS[value] ?? value;
  }
  if (typeof value === 'boolean') {
    return value ? 'Evet' : 'Hayır';
  }
  if (typeof value === 'number') {
    return String(value);
  }
  if (typeof value === 'string') {
    if (value.length === 0) {
      return null;
    }
    if (key === 'effectiveUntil' || key.endsWith('At')) {
      try {
        return new Intl.DateTimeFormat('tr-TR', {
          dateStyle: 'short',
          timeStyle: 'short',
        }).format(new Date(value));
      } catch {
        return value;
      }
    }
    if (key === 'failedReason' && value.length > 120) {
      return `${value.slice(0, 120)}…`;
    }
    return value;
  }
  if (Array.isArray(value)) {
    const flat = value.filter((v) => typeof v === 'string') as string[];
    if (flat.length === 0) {
      return null;
    }
    return flat.join(', ');
  }
  return null;
}

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

/** Ham eylem kodunu Türkçe etikete çevirir */
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

/** Kaynak türü (resource / resourceType) etiketi */
export function formatAuditLogResource(resource: string | null | undefined): string {
  if (resource == null || resource === '') {
    return '—';
  }
  return AUDIT_LOG_RESOURCE_LABELS[resource] ?? resource.replace(/([a-z])([A-Z])/g, '$1 $2');
}

/** Kaynak + isteğe bağlı kimlik (kısa gösterim) */
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

export interface AuditLogMetadataLine {
  label: string;
  value: string;
}

function normalizeMetadataRecord(
  metadata: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (metadata == null || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return {};
  }
  return metadata;
}

/** Metadata’dan kullanıcıya yönelik özet satırları */
export function buildAuditLogMetadataSummary(
  metadata: Record<string, unknown> | null | undefined,
  action?: string,
): AuditLogMetadataLine[] {
  const meta = normalizeMetadataRecord(metadata);
  if (Object.keys(meta).length === 0) {
    return [];
  }

  const lines: AuditLogMetadataLine[] = [];
  const seen = new Set<string>();

  const push = (key: string, raw: unknown): void => {
    if (METADATA_SKIP_KEYS.has(key) || seen.has(key)) {
      return;
    }
    const value = formatMetadataScalar(key, raw);
    if (value === null) {
      return;
    }
    seen.add(key);
    lines.push({
      label: METADATA_FIELD_LABELS[key] ?? key,
      value,
    });
  };

  for (const key of METADATA_SUMMARY_ORDER) {
    if (key in meta) {
      push(key, meta[key]);
    }
  }

  if (meta.source === 'prisma_middleware' && !seen.has('prismaModel')) {
    const model =
      typeof meta.prismaModel === 'string' ? meta.prismaModel : null;
    const prismaAction =
      typeof meta.prismaAction === 'string' ? meta.prismaAction : null;
    if (model && prismaAction) {
      lines.unshift({
        label: 'Kayıt',
        value: formatPrismaMiddlewareAction(`${model}.${prismaAction}`) ?? model,
      });
    }
  }

  if (action === 'queue.job_failed' && typeof meta.jobName === 'string') {
    const jobLabel = SYNC_QUEUE_JOB_LABELS[meta.jobName];
    if (jobLabel && !lines.some((l) => l.label === 'İş')) {
      lines.unshift({ label: 'İş', value: jobLabel });
    }
  }

  for (const [key, raw] of Object.entries(meta)) {
    if (METADATA_SUMMARY_ORDER.includes(key as (typeof METADATA_SUMMARY_ORDER)[number])) {
      continue;
    }
    if (METADATA_SKIP_KEYS.has(key)) {
      continue;
    }
    if (isRecord(raw) || Array.isArray(raw)) {
      continue;
    }
    push(key, raw);
  }

  return lines.slice(0, 6);
}

/** Tek satırlık metadata özeti (liste / kart görünümü) */
export function formatAuditLogMetadataOneLiner(
  metadata: Record<string, unknown> | null | undefined,
  action?: string,
): string {
  const lines = buildAuditLogMetadataSummary(metadata, action);
  if (lines.length === 0) {
    return '';
  }
  return lines.map((l) => `${l.label}: ${l.value}`).join(' · ');
}

export function auditLogUserLabel(
  entry: Pick<AuditLogEntry, 'userId' | 'userEmail' | 'userName'>,
): string {
  if (entry.userName?.trim()) {
    return entry.userName.trim();
  }
  if (entry.userEmail?.trim()) {
    return entry.userEmail.trim();
  }
  return entry.userId;
}
