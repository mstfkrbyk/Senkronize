import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'fs';
import { join } from 'path';

import type {
  CriticalStockForecastEmailData,
  DigestEmailData,
  DigestNotificationRow,
  EmailPreviewTemplate,
  InvoiceEmailData,
  LowStockEmailData,
  OrderEmailData,
  PartnerInviteData,
  PlanChangedData,
  TrialExpiringData,
  WelcomeEmailData,
} from './email-template.types';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const EMAIL_PREVIEW_TEMPLATE_KEYS: readonly EmailPreviewTemplate[] = [
  'welcome',
  'order-new',
  'low-stock',
  'trial-expiring',
  'plan-changed',
  'invoice',
  'partner-invite',
] as const;

export function isEmailPreviewTemplate(value: string): value is EmailPreviewTemplate {
  return (EMAIL_PREVIEW_TEMPLATE_KEYS as readonly string[]).includes(value);
}

@Injectable()
export class EmailTemplateService {
  private readonly templateCache = new Map<string, string>();

  constructor(private readonly config: ConfigService) {}

  private panelBaseUrl(): string {
    return this.config.get<string>('PANEL_URL') ?? 'https://app.senkronize.com';
  }

  private unsubscribeUrl(): string {
    return `${this.panelBaseUrl()}/settings/notifications`;
  }

  private getTemplate(name: string): string {
    const cached = this.templateCache.get(name);
    if (cached !== undefined) {
      return cached;
    }
    const fullPath = join(__dirname, 'templates', `${name}.html`);
    const raw = readFileSync(fullPath, 'utf-8');
    this.templateCache.set(name, raw);
    return raw;
  }

  private renderTemplate(name: string, data: Record<string, unknown>): string {
    const template = this.getTemplate(name);
    return this.interpolate(template, data);
  }

  private interpolate(template: string, data: Record<string, unknown>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
      const v = data[key];
      if (v === undefined || v === null) {
        return '';
      }
      return String(v);
    });
  }

  private formatAddressForHtml(address: string): string {
    const trimmed = address.trim();
    if (trimmed.length === 0) {
      return '—';
    }
    const parts = trimmed.split(/\r?\n/).map((line) => escapeHtml(line.trim()));
    return parts.join('<br />');
  }

  private buildOrderItemRows(items: OrderEmailData['items']): string {
    return items
      .map(
        (item) =>
          `<tr>
            <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#334155;">${escapeHtml(item.name)}</td>
            <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#334155;text-align:center;">${String(item.quantity)}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#0f172a;text-align:right;font-weight:600;">${escapeHtml(item.lineTotalTry)}</td>
          </tr>`,
      )
      .join('');
  }

  private buildLowStockRows(products: LowStockEmailData['products']): string {
    return products
      .map(
        (p) =>
          `<tr>
            <td style="padding:10px 10px;border-bottom:1px solid #fde68a;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#334155;">${escapeHtml(p.name)}</td>
            <td style="padding:10px 8px;border-bottom:1px solid #fde68a;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#64748b;">${escapeHtml(p.sku)}</td>
            <td style="padding:10px 6px;border-bottom:1px solid #fde68a;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#b45309;text-align:center;font-weight:700;">${String(p.currentStock)}</td>
            <td style="padding:10px 8px;border-bottom:1px solid #fde68a;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#334155;text-align:center;">${String(p.threshold)}</td>
          </tr>`,
      )
      .join('');
  }

  private buildCriticalStockForecastRows(
    products: CriticalStockForecastEmailData['products'],
  ): string {
    return products
      .map(
        (p) =>
          `<tr>
            <td style="padding:10px 10px;border-bottom:1px solid #fecaca;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#334155;">${escapeHtml(p.name)}</td>
            <td style="padding:10px 8px;border-bottom:1px solid #fecaca;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#64748b;">${escapeHtml(p.barcode)}</td>
            <td style="padding:10px 6px;border-bottom:1px solid #fecaca;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#b91c1c;text-align:center;font-weight:700;">${escapeHtml(p.daysLeft)}</td>
            <td style="padding:10px 8px;border-bottom:1px solid #fecaca;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#334155;text-align:center;">${escapeHtml(p.recommendedQty)}</td>
          </tr>`,
      )
      .join('');
  }

  private buildTrialLostFeaturesRows(features: string[]): string {
    if (features.length === 0) {
      return '<span style="color:#991b1b;">Deneme bittiğinde panele erişiminiz kısıtlanır ve senkronizasyonlar durdurulur.</span>';
    }
    return features.map((f) => `• ${escapeHtml(f)}`).join('<br />');
  }

  private buildPlanFeatureRows(features: string[]): string {
    if (features.length === 0) {
      return `<tr><td style="padding:12px 14px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#64748b;line-height:1.55;">Plan değişikliğiniz kayda alındı. Fatura döneminiz ve erişim süreniz mevcut koşullarınıza göre devam eder.</td></tr>`;
    }
    return features
      .map(
        (f) =>
          `<tr><td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#334155;">• ${escapeHtml(f)}</td></tr>`,
      )
      .join('');
  }

  renderWelcome(data: WelcomeEmailData): string {
    const base = this.panelBaseUrl();
    return this.renderTemplate('welcome', {
      name: escapeHtml(data.name),
      connectionsUrl: escapeHtml(`${base}/connections`),
      unsubscribeUrl: escapeHtml(this.unsubscribeUrl()),
    });
  }

  renderOrderNew(data: OrderEmailData): string {
    return this.renderTemplate('order-new', {
      orderNumber: escapeHtml(data.orderNumber),
      platform: escapeHtml(data.platform),
      orderDate: escapeHtml(data.orderDate),
      totalTry: escapeHtml(data.totalTry),
      deliveryAddress: this.formatAddressForHtml(data.deliveryAddress),
      orderViewUrl: escapeHtml(data.orderViewUrl),
      unsubscribeUrl: escapeHtml(this.unsubscribeUrl()),
      orderItemRows: this.buildOrderItemRows(data.items),
    });
  }

  renderLowStock(data: LowStockEmailData): string {
    return this.renderTemplate('low-stock', {
      recipientName: escapeHtml(data.recipientName),
      count: String(data.count),
      stockUpdateUrl: escapeHtml(data.stockUpdateUrl),
      unsubscribeUrl: escapeHtml(this.unsubscribeUrl()),
      productRows: this.buildLowStockRows(data.products),
    });
  }

  renderCriticalStockForecast(data: CriticalStockForecastEmailData): string {
    return this.renderTemplate('critical-stock-forecast', {
      recipientName: escapeHtml(data.recipientName),
      count: String(data.count),
      forecastUrl: escapeHtml(data.forecastUrl),
      unsubscribeUrl: escapeHtml(this.unsubscribeUrl()),
      productRows: this.buildCriticalStockForecastRows(data.products),
    });
  }

  renderTrialExpiring(data: TrialExpiringData): string {
    return this.renderTemplate('trial-expiring', {
      name: escapeHtml(data.name),
      trialEndDate: escapeHtml(data.trialEndDate),
      daysLeft: String(data.daysLeft),
      currentPlanLabel: escapeHtml(data.currentPlanLabel),
      suggestedPlanLabel: escapeHtml(data.suggestedPlanLabel),
      subscribeUrl: escapeHtml(data.subscribeUrl),
      ordersCount: String(data.ordersCount),
      syncJobsCount: String(data.syncJobsCount),
      lostFeaturesRows: this.buildTrialLostFeaturesRows(data.lostFeatures),
      unsubscribeUrl: escapeHtml(this.unsubscribeUrl()),
    });
  }

  renderPlanChanged(data: PlanChangedData): string {
    const upgradeSectionTitle = data.isUpgrade
      ? 'Yeni özellikleriniz'
      : 'Plan özeti';
    return this.renderTemplate('plan-changed', {
      name: escapeHtml(data.name),
      previousPlanLabel: escapeHtml(data.previousPlanLabel),
      newPlanLabel: escapeHtml(data.newPlanLabel),
      effectiveDate: escapeHtml(data.effectiveDate),
      exploreUrl: escapeHtml(data.exploreUrl),
      upgradeSectionTitle: escapeHtml(upgradeSectionTitle),
      newFeaturesRows: this.buildPlanFeatureRows(data.newFeatures),
      unsubscribeUrl: escapeHtml(this.unsubscribeUrl()),
    });
  }

  renderInvoice(data: InvoiceEmailData): string {
    const taxLine =
      data.companyTaxId.trim().length > 0
        ? `VKN: ${escapeHtml(data.companyTaxId.trim())}`
        : '—';
    const addressLines = this.formatAddressForHtml(data.companyAddress);
    return this.renderTemplate('invoice', {
      recipientName: escapeHtml(data.recipientName),
      invoiceNumber: escapeHtml(data.invoiceNumber),
      invoiceDate: escapeHtml(data.invoiceDate),
      companyName: escapeHtml(data.companyName),
      companyTaxId: taxLine,
      companyAddressLines: addressLines,
      planName: escapeHtml(data.planName),
      billingPeriodLabel: escapeHtml(data.billingPeriodLabel),
      amountExclVatTry: escapeHtml(data.amountExclVatTry),
      vatRatePercent: escapeHtml(data.vatRatePercent),
      vatAmountTry: escapeHtml(data.vatAmountTry),
      totalInclVatTry: escapeHtml(data.totalInclVatTry),
      invoiceDownloadUrl: escapeHtml(data.invoiceDownloadUrl),
      nextPaymentDate: escapeHtml(data.nextPaymentDate),
      unsubscribeUrl: escapeHtml(this.unsubscribeUrl()),
    });
  }

  buildDigestEmailData(
    recipientName: string,
    period: string,
    notifications: DigestNotificationRow[],
  ): DigestEmailData {
    const panelUrl = this.panelBaseUrl();
    const periodLabel =
      period === 'weekly' ? 'Haftalık bildirim özeti' : 'Günlük bildirim özeti';

    const orderItems = notifications.filter((n) => n.eventType === 'new_order');
    const stockItems = notifications.filter((n) =>
      ['low_stock', 'stock_out'].includes(n.eventType),
    );
    const syncItems = notifications.filter((n) => n.eventType === 'sync_error');
    const otherItems = notifications.filter(
      (n) =>
        !['new_order', 'low_stock', 'stock_out', 'sync_error'].includes(
          n.eventType,
        ),
    );

    return {
      recipientName: escapeHtml(recipientName),
      periodLabel: escapeHtml(periodLabel),
      totalCount: notifications.length,
      ordersSection: this.buildDigestSection('Yeni siparişler', orderItems, panelUrl),
      stockSection: this.buildDigestSection('Stok uyarıları', stockItems, panelUrl),
      syncSection: this.buildDigestSection('Senkron hataları', syncItems, panelUrl),
      otherSection: this.buildDigestSection('Diğer', otherItems, panelUrl),
      panelUrl: escapeHtml(panelUrl),
      settingsUrl: escapeHtml(this.unsubscribeUrl()),
    };
  }

  renderDigest(data: DigestEmailData): string {
    return this.renderTemplate('digest', {
      recipientName: data.recipientName,
      periodLabel: data.periodLabel,
      totalCount: String(data.totalCount),
      ordersSection: data.ordersSection,
      stockSection: data.stockSection,
      syncSection: data.syncSection,
      otherSection: data.otherSection,
      panelUrl: data.panelUrl,
      settingsUrl: data.settingsUrl,
    });
  }

  private buildDigestSection(
    heading: string,
    items: DigestNotificationRow[],
    panelBase: string,
  ): string {
    if (items.length === 0) {
      return '';
    }
    const rows = items
      .map((item) => {
        const href = item.link
          ? `${panelBase}${item.link.startsWith('/') ? item.link : `/${item.link}`}`
          : panelBase;
        return `
        <tr>
          <td style="padding:12px 16px;border-top:1px solid #e2e8f0;font-family:Arial,Helvetica,sans-serif;">
            <div style="font-size:14px;font-weight:700;color:#0f172a;">${escapeHtml(item.title)}</div>
            <div style="font-size:13px;color:#64748b;margin-top:4px;">${escapeHtml(item.message)}</div>
            <div style="font-size:12px;color:#94a3b8;margin-top:6px;">${escapeHtml(item.createdAt)}</div>
            <a href="${escapeHtml(href)}" style="display:inline-block;margin-top:8px;font-size:13px;color:#38bdf8;text-decoration:none;font-weight:600;">Panele Git →</a>
          </td>
        </tr>`;
      })
      .join('');

    return `
    <tr>
      <td style="padding:16px 24px 0 24px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;color:#334155;">
        ${escapeHtml(heading)} (${String(items.length)})
      </td>
    </tr>
    <tr>
      <td style="padding:8px 24px 16px 24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
          ${rows}
        </table>
      </td>
    </tr>`;
  }

  renderPartnerInvite(data: PartnerInviteData): string {
    const logoUrl = data.partnerLogoUrl?.trim();
    const partnerLogoBlock =
      logoUrl !== undefined && logoUrl.length > 0
        ? `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(data.partnerName)}" width="120" style="max-width:160px;height:auto;display:block;margin:0 auto;border:0;" />`
        : `<div style="font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:700;color:#6366f1;letter-spacing:-0.5px;">Senkronize</div><div style="height:4px;width:48px;background-color:#6366f1;border-radius:2px;margin:12px auto 0 auto;"></div>`;

    const message = data.message?.trim();
    const messageBlock =
      message !== undefined && message.length > 0
        ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e2e8f0;border-radius:10px;background-color:#f8fafc;"><tr><td style="padding:14px 16px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#334155;line-height:1.55;">${escapeHtml(message).replace(/\r?\n/g, '<br />')}</td></tr></table>`
        : '';

    return this.renderTemplate('partner-invite', {
      partnerName: escapeHtml(data.partnerName),
      platformName: escapeHtml(data.platformName),
      inviteUrl: escapeHtml(data.inviteUrl),
      partnerLogoBlock,
      messageBlock,
      unsubscribeUrl: escapeHtml(this.unsubscribeUrl()),
    });
  }

  previewHtml(template: EmailPreviewTemplate): string {
    switch (template) {
      case 'welcome':
        return this.renderWelcome({ name: 'Ayşe Yılmaz' });
      case 'order-new':
        return this.renderOrderNew({
          orderNumber: 'TY-104821',
          platform: 'Trendyol',
          orderDate: '18.05.2026 14:32',
          totalTry: '2.459,90 ₺',
          items: [
            {
              name: 'Organik Zeytinyağı 500 ml',
              quantity: 2,
              lineTotalTry: '899,80 ₺',
            },
            {
              name: 'Kargo / Hizmet',
              quantity: 1,
              lineTotalTry: '49,90 ₺',
            },
          ],
          deliveryAddress:
            'Senkronize Lojistik A.Ş.\nMerkez Mah. İstanbul Cd. No:12\n34000 Kadıköy / İstanbul',
          orderViewUrl: `${this.panelBaseUrl()}/orders/demo`,
        });
      case 'low-stock':
        return this.renderLowStock({
          recipientName: 'Mehmet',
          count: 3,
          products: [
            { name: 'Bluetooth Kulaklık V2', sku: '8680001112233', currentStock: 2, threshold: 5 },
            { name: 'USB-C Kablo 2m', sku: 'SKU-CBL-2M', currentStock: 1, threshold: 5 },
          ],
          stockUpdateUrl: `${this.panelBaseUrl()}/stock`,
        });
      case 'trial-expiring':
        return this.renderTrialExpiring({
          name: 'Mehmet',
          trialEndDate: '21.05.2026',
          daysLeft: 3,
          lostFeatures: [
            'Çoklu pazaryeri senkronizasyonu',
            'Otomatik stok ve fiyat güncellemeleri',
            'Sipariş ve kargo takibi',
          ],
          currentPlanLabel: '14 günlük deneme',
          suggestedPlanLabel: 'Senkronize — Gelişim Paketi',
          subscribeUrl: `${this.panelBaseUrl()}/settings/subscription`,
          ordersCount: 128,
          syncJobsCount: 42,
        });
      case 'plan-changed':
        return this.renderPlanChanged({
          name: 'Mehmet',
          previousPlanLabel: 'Senkronize — Başlangıç Paketi',
          newPlanLabel: 'Senkronize — Pro Paket',
          effectiveDate: '18.05.2026',
          newFeatures: [
            'Aylık sipariş limiti: 10.000',
            '10 pazaryeri bağlantısı',
            '15 kullanıcı kotası',
          ],
          exploreUrl: `${this.panelBaseUrl()}/settings/subscription`,
          isUpgrade: true,
        });
      case 'invoice':
        return this.renderInvoice({
          recipientName: 'Mehmet',
          invoiceNumber: 'INV-2026-001842',
          invoiceDate: '18.05.2026',
          companyName: 'Demo Mağaza A.Ş.',
          companyTaxId: '1234567890',
          companyAddress: 'Levent Mah. İstanbul\nBeşiktaş / İstanbul',
          planName: 'Senkronize — Pro Paket',
          billingPeriodLabel: '18.05.2026 — 18.05.2027',
          amountExclVatTry: '825,00 ₺',
          vatRatePercent: '%20',
          vatAmountTry: '165,00 ₺',
          totalInclVatTry: '990,00 ₺',
          invoiceDownloadUrl: `${this.panelBaseUrl()}/settings/subscription`,
          nextPaymentDate: '18.05.2027',
        });
      case 'partner-invite':
        return this.renderPartnerInvite({
          partnerName: 'Entegrasyon Partner A.Ş.',
          platformName: 'Trendyol',
          inviteUrl: `${this.panelBaseUrl()}/register?invite=demo`,
          message:
            'Merhaba,\n\nSizi mağazanızı Senkronize üzerinden yönetmeye davet ediyoruz. Kurulumda yardımcı olmaktan memnuniyet duyarız.',
        });
      default: {
        const exhaustive: never = template;
        return exhaustive;
      }
    }
  }
}
