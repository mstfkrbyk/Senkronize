import type { TemplateData } from '../notification.types';
import { escapeHtml, wrapEmail } from './email-shell';

function pick(data: TemplateData, key: string): string {
  const v = data[key];
  if (v === undefined || v === null) {
    return '';
  }
  return escapeHtml(String(v));
}

export function paymentSuccessTemplate(data: TemplateData): string {
  const orgName = pick(data, 'orgName') || 'Organizasyonunuz';
  const amount = pick(data, 'amount');
  const planName = pick(data, 'planName');
  const periodEnd = pick(data, 'periodEnd');
  const inner = `
    <p style="margin:0 0 16px;">Merhaba,</p>
    <p style="margin:0 0 16px;"><strong>${orgName}</strong> için ödemeniz başarıyla alındı.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px 0;width:100%;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;">
      <tr><td style="padding:12px 16px;"><span style="color:#64748b;">Tutar</span><br/><strong style="color:#0f172a;">${amount}</strong></td></tr>
      <tr><td style="padding:12px 16px;border-top:1px solid #e2e8f0;"><span style="color:#64748b;">Plan</span><br/><strong style="color:#0f172a;">${planName}</strong></td></tr>
      <tr><td style="padding:12px 16px;border-top:1px solid #e2e8f0;"><span style="color:#64748b;">Dönem sonu</span><br/><strong style="color:#0f172a;">${periodEnd}</strong></td></tr>
    </table>
    <p style="margin:0;">Teşekkür ederiz.</p>
  `;
  return wrapEmail(inner);
}
