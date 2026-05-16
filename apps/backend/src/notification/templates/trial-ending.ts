import type { TemplateData } from '../notification.types';
import { escapeHtml, safeHref, wrapEmail } from './email-shell';

function pick(data: TemplateData, key: string): string {
  const v = data[key];
  if (v === undefined || v === null) {
    return '';
  }
  return escapeHtml(String(v));
}

export function trialEndingTemplate(data: TemplateData): string {
  const orgName = pick(data, 'orgName') || 'Organizasyonunuz';
  const daysLeft = pick(data, 'daysLeft');
  const upgradeUrl = safeHref(data.upgradeUrl);
  const inner = `
    <p style="margin:0 0 16px;">Merhaba,</p>
    <p style="margin:0 0 16px;"><strong>${orgName}</strong> için deneme sürenizin bitmesine <strong>${daysLeft || '?'}</strong> gün kaldı.</p>
    <p style="margin:0 0 20px;">Kesinti yaşamamak için şimdi yükseltme yapabilirsiniz.</p>
    <p style="margin:0;">
      <a href="${upgradeUrl}" style="display:inline-block;background:#4F46E5;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:6px;font-weight:600;font-size:14px;">Paketi yükselt</a>
    </p>
  `;
  return wrapEmail(inner);
}
