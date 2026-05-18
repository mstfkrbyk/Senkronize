import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly apiKey: string;
  private readonly from = 'Senkronize <noreply@senkronize.com>';

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('RESEND_API_KEY') ?? '';
  }

  private panelBaseUrl(): string {
    return this.config.get<string>('PANEL_URL') ?? 'https://app.senkronize.com';
  }

  private async send(to: string, subject: string, html: string): Promise<void> {
    if (!this.apiKey || this.apiKey === 'placeholder') {
      this.logger.warn(`[EMAIL MOCK] To: ${to} | Subject: ${subject}`);
      return;
    }
    try {
      await axios.post(
        'https://api.resend.com/emails',
        { from: this.from, to, subject, html },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        },
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Email send failed: ${message}`);
    }
  }

  async sendWelcome(to: string, name: string): Promise<void> {
    const base = this.panelBaseUrl();
    await this.send(
      to,
      "Senkronize'ye Hoş Geldiniz!",
      `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <h1 style="color:#1a1a1a">Hoş Geldiniz, ${name}!</h1>
        <p>Senkronize hesabınız başarıyla oluşturuldu.</p>
        <p>14 günlük ücretsiz deneme süreniz başladı. Panele giriş yaparak ilk bağlantınızı ekleyebilirsiniz.</p>
        <a href="${base}/connections"
           style="background:#4f46e5;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin-top:16px">
          Panele Git
        </a>
        <p style="color:#666;font-size:14px;margin-top:32px">Senkronize Ekibi</p>
      </div>
    `,
    );
  }

  async sendTrialExpiring(to: string, name: string, daysLeft: number): Promise<void> {
    const base = this.panelBaseUrl();
    await this.send(
      to,
      `Deneme süreniz ${daysLeft} gün içinde bitiyor`,
      `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <h2>Merhaba ${name},</h2>
        <p>Senkronize ücretsiz deneme sürenizin bitmesine <strong>${daysLeft} gün</strong> kaldı.</p>
        <p>Hizmet kesintisi yaşamamak için bir plan seçin.</p>
        <a href="${base}/settings/subscription"
           style="background:#4f46e5;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin-top:16px">
          Plan Seç
        </a>
      </div>
    `,
    );
  }

  async sendSubscriptionConfirm(
    to: string,
    name: string,
    plan: string,
    nextBillingDate: Date,
  ): Promise<void> {
    const base = this.panelBaseUrl();
    await this.send(
      to,
      `${plan} planı aktivasyon onayı`,
      `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <h2>Merhaba ${name},</h2>
        <p><strong>${plan}</strong> planınız aktive edildi.</p>
        <p>Sonraki fatura tarihi: <strong>${nextBillingDate.toLocaleDateString('tr-TR')}</strong></p>
        <a href="${base}"
           style="background:#4f46e5;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin-top:16px">
          Panele Git
        </a>
      </div>
    `,
    );
  }

  async sendLowStockAlert(
    to: string,
    name: string,
    products: { name: string; stock: number }[],
  ): Promise<void> {
    const rows = products
      .map(
        (p) =>
          `<tr><td style="padding:8px;border-bottom:1px solid #eee">${p.name}</td><td style="padding:8px;border-bottom:1px solid #eee;color:#ef4444">${p.stock}</td></tr>`,
      )
      .join('');
    await this.send(
      to,
      `${products.length} ürünün stoğu kritik seviyede`,
      `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <h2>Merhaba ${name},</h2>
        <p>Aşağıdaki ürünlerin stok seviyesi kritik eşiğin altına düştü:</p>
        <table style="width:100%;border-collapse:collapse">
          <thead><tr><th style="text-align:left;padding:8px;background:#f5f5f5">Ürün</th><th style="text-align:left;padding:8px;background:#f5f5f5">Stok</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `,
    );
  }

  async sendJobFailureAlert(
    to: string,
    detail: {
      queueLabel: string;
      jobName: string;
      organizationId?: string;
      errorMessage: string;
      jobId?: string;
    },
  ): Promise<void> {
    const orgLine = detail.organizationId
      ? `<p><strong>Organizasyon:</strong> ${detail.organizationId}</p>`
      : '';
    const jobIdLine = detail.jobId
      ? `<p><strong>Job ID:</strong> ${detail.jobId}</p>`
      : '';
    await this.send(
      to,
      `[Senkronize] Kuyruk hatası: ${detail.queueLabel} / ${detail.jobName}`,
      `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <h2>Pazaryeri kuyruk işi kalıcı olarak başarısız</h2>
        <p><strong>Kuyruk:</strong> ${detail.queueLabel}</p>
        <p><strong>İş adı:</strong> ${detail.jobName}</p>
        ${orgLine}
        ${jobIdLine}
        <p><strong>Hata:</strong> ${detail.errorMessage
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')}</p>
        <p style="color:#666;font-size:14px">Bu bildirim, iş tüm yeniden denemeler sonunda başarısız kaldığında gönderilir.</p>
      </div>
    `,
    );
  }
}
