import type { TemplateData } from '../notification.types';
import { escapeHtml, safeHref, wrapEmail } from './email-shell';

function pick(data: TemplateData, key: string): string {
  const v = data[key];
  if (v === undefined || v === null) {
    return '';
  }
  return escapeHtml(String(v));
}

export function orderNewTemplate(data: TemplateData): string {
  const orgName = pick(data, 'orgName') || 'Organizasyonunuz';
  const orderNo = pick(data, 'orderNumber') || pick(data, 'orderNo');
  const marketplace = pick(data, 'marketplace') || pick(data, 'platform');
  const inner = `
    <p style="margin:0 0 16px;">Merhaba,</p>
    <p style="margin:0 0 16px;"><strong>${orgName}</strong> için yeni bir sipariş alındı.</p>
    <p style="margin:0 0 8px;"><strong>Sipariş:</strong> ${orderNo}</p>
    <p style="margin:0;"><strong>Pazaryeri:</strong> ${marketplace}</p>
  `;
  return wrapEmail(inner);
}

export function stockAlertTemplate(data: TemplateData): string {
  const orgName = pick(data, 'orgName') || 'Organizasyonunuz';
  const sku = pick(data, 'sku');
  const productName = pick(data, 'productName');
  const link = safeHref(data.link);
  const inner = `
    <p style="margin:0 0 16px;">Merhaba,</p>
    <p style="margin:0 0 16px;"><strong>${orgName}</strong> için stok uyarısı.</p>
    <p style="margin:0 0 8px;"><strong>Ürün:</strong> ${productName}</p>
    <p style="margin:0 0 16px;"><strong>SKU:</strong> ${sku}</p>
    <p style="margin:0;">
      <a href="${link}" style="display:inline-block;background:#4F46E5;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:6px;font-weight:600;font-size:14px;">Panelde görüntüle</a>
    </p>
  `;
  return wrapEmail(inner);
}

export function syncErrorTemplate(data: TemplateData): string {
  const orgName = pick(data, 'orgName') || 'Organizasyonunuz';
  const platform = pick(data, 'platform');
  const errorSummary = pick(data, 'errorSummary') || pick(data, 'message');
  const inner = `
    <p style="margin:0 0 16px;">Merhaba,</p>
    <p style="margin:0 0 16px;"><strong>${orgName}</strong> için senkronizasyon hatası oluştu.</p>
    <p style="margin:0 0 8px;"><strong>Kaynak:</strong> ${platform}</p>
    <p style="margin:0;padding:12px 16px;background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;color:#9a3412;"><strong>Özet:</strong> ${errorSummary}</p>
  `;
  return wrapEmail(inner);
}

export function passwordResetTemplate(data: TemplateData): string {
  const resetUrl = safeHref(data.resetUrl);
  const expiresIn = pick(data, 'expiresIn') || '15 dakika';
  const inner = `
    <p style="margin:0 0 16px;">Merhaba,</p>
    <p style="margin:0 0 16px;">Şifre sıfırlama talebinde bulundunuz. Aşağıdaki bağlantı <strong>${expiresIn}</strong> geçerlidir.</p>
    <p style="margin:0 0 20px;">
      <a href="${resetUrl}" style="display:inline-block;background:#4F46E5;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:6px;font-weight:600;font-size:14px;">Şifreyi sıfırla</a>
    </p>
    <p style="margin:0;color:#64748b;font-size:13px;">Bu talebi siz oluşturmadıysanız bu e-postayı yok sayabilirsiniz.</p>
  `;
  return wrapEmail(inner);
}
