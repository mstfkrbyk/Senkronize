import type { TemplateData } from '../notification.types';
import { escapeHtml, safeHref, wrapEmail } from './email-shell';

function pick(data: TemplateData, key: string): string {
  const v = data[key];
  if (v === undefined || v === null) {
    return '';
  }
  return escapeHtml(String(v));
}

export function inviteUserTemplate(data: TemplateData): string {
  const inviterName = pick(data, 'inviterName') || 'Bir ekip arkadaşınız';
  const orgName = pick(data, 'orgName') || 'Organizasyon';
  const inviteUrl = safeHref(data.inviteUrl);
  const inner = `
    <p style="margin:0 0 16px;">Merhaba,</p>
    <p style="margin:0 0 16px;"><strong>${inviterName}</strong> sizi <strong>${orgName}</strong> organizasyonuna Senkronize üzerinden davet etti.</p>
    <p style="margin:0 0 20px;">Daveti kabul etmek için aşağıdaki bağlantıya tıklayın.</p>
    <p style="margin:0;">
      <a href="${inviteUrl}" style="display:inline-block;background:#4F46E5;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:6px;font-weight:600;font-size:14px;">Daveti aç</a>
    </p>
  `;
  return wrapEmail(inner);
}
