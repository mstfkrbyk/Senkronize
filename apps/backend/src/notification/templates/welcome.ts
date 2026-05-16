import type { TemplateData } from '../notification.types';
import { escapeHtml, wrapEmail } from './email-shell';

function pick(data: TemplateData, key: string): string {
  const v = data[key];
  if (v === undefined || v === null) {
    return '';
  }
  return escapeHtml(String(v));
}

export function welcomeTemplate(data: TemplateData): string {
  const orgName = pick(data, 'orgName') || 'Organizasyonunuz';
  const userEmail = pick(data, 'userEmail') || pick(data, 'email');
  const inner = `
    <p style="margin:0 0 16px;">Merhaba,</p>
    <p style="margin:0 0 16px;"><strong>${orgName}</strong> için Senkronize hesabınız hazır.</p>
    <p style="margin:0 0 16px;">14 günlük deneme süreniz başladı. Bu sürede paket özelliklerini keşfedebilirsiniz.</p>
    <p style="margin:0 0 16px;">Kayıtlı e-posta: <strong>${userEmail}</strong></p>
    <p style="margin:0;">İyi çalışmalar dileriz.</p>
  `;
  return wrapEmail(inner);
}
