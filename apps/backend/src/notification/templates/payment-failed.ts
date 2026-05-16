import type { TemplateData } from '../notification.types';
import { escapeHtml, wrapEmail } from './email-shell';

function pick(data: TemplateData, key: string): string {
  const v = data[key];
  if (v === undefined || v === null) {
    return '';
  }
  return escapeHtml(String(v));
}

export function paymentFailedTemplate(data: TemplateData): string {
  const orgName = pick(data, 'orgName') || 'Organizasyonunuz';
  const amount = pick(data, 'amount');
  const failReason = pick(data, 'failReason');
  const inner = `
    <p style="margin:0 0 16px;">Merhaba,</p>
    <p style="margin:0 0 16px;"><strong>${orgName}</strong> için gerçekleştirmeye çalıştığınız ödeme tamamlanamadı.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px 0;width:100%;background:#fef2f2;border-radius:8px;border:1px solid #fecaca;">
      <tr><td style="padding:12px 16px;"><span style="color:#64748b;">Tutar</span><br/><strong style="color:#991b1b;">${amount}</strong></td></tr>
      <tr><td style="padding:12px 16px;border-top:1px solid #fecaca;"><span style="color:#64748b;">Açıklama</span><br/><strong style="color:#0f172a;">${failReason || 'Bilinmeyen hata'}</strong></td></tr>
    </table>
    <p style="margin:0;">Kart bilgilerinizi kontrol edip tekrar deneyebilir veya destek ile iletişime geçebilirsiniz.</p>
  `;
  return wrapEmail(inner);
}
