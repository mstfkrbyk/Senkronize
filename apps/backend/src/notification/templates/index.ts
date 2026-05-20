import type { TemplateData } from '../notification.types';
import {
  orderNewTemplate,
  passwordResetTemplate,
  stockAlertTemplate,
  syncErrorTemplate,
} from './extra-templates';
import { inviteUserTemplate } from './invite-user';
import { paymentFailedTemplate } from './payment-failed';
import { paymentSuccessTemplate } from './payment-success';
import { trialExpiredTemplate } from './trial-expired';
import { trialEndingTemplate } from './trial-ending';
import { welcomeTemplate } from './welcome';

export function renderTemplate(
  template: string,
  data: TemplateData,
): { subject: string; html: string } {
  switch (template) {
    case 'welcome':
      return {
        subject: "Senkronize'e Hoş Geldiniz!",
        html: welcomeTemplate(data),
      };
    case 'trial_ending':
      return {
        subject: 'Deneme Süreniz Bitiyor',
        html: trialEndingTemplate(data),
      };
    case 'trial_expired':
      return {
        subject: 'Deneme Süreniz Sona Erdi',
        html: trialExpiredTemplate(data),
      };
    case 'payment_success':
      return {
        subject: 'Ödemeniz Alındı',
        html: paymentSuccessTemplate(data),
      };
    case 'payment_failed':
      return {
        subject: 'Ödeme Başarısız',
        html: paymentFailedTemplate(data),
      };
    case 'invite_user':
      return {
        subject: "Senkronize'e Davet Edildiniz",
        html: inviteUserTemplate(data),
      };
    case 'order_new':
      return {
        subject: 'Yeni Sipariş',
        html: orderNewTemplate(data),
      };
    case 'stock_alert':
      return {
        subject: 'Stok Uyarısı',
        html: stockAlertTemplate(data),
      };
    case 'sync_error':
      return {
        subject: 'Senkronizasyon Hatası',
        html: syncErrorTemplate(data),
      };
    case 'password_reset':
      return {
        subject: 'Şifre Sıfırlama',
        html: passwordResetTemplate(data),
      };
    case 'webhook_endpoint_disabled':
      return {
        subject: 'Webhook uç noktası devre dışı',
        html:
          typeof data.message === 'string'
            ? `<p>${data.message}</p><p>Lütfen panelden webhook ayarlarını kontrol edin.</p>`
            : '<p>Webhook uç noktanız ardışık başarısız teslimatlar nedeniyle devre dışı bırakıldı.</p>',
      };
    default: {
      const msg = data.message;
      return {
        subject: template,
        html:
          typeof msg === 'string' || typeof msg === 'number'
            ? String(msg)
            : '',
      };
    }
  }
}
