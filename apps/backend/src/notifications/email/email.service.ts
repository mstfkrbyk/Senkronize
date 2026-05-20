import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

import type { NotificationEvent } from '../notification.types';
import type {
  CriticalStockForecastEmailData,
  InvoiceEmailData,
  LowStockEmailData,
  OrderEmailData,
  PartnerInviteData,
  PlanChangedData,
  TrialExpiringData,
  WelcomeEmailData,
} from './email-template.types';
import { EmailTemplateService } from './email-template.service';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly apiKey: string;
  private readonly from = 'Senkronize <noreply@senkronize.com>';

  constructor(
    private readonly config: ConfigService,
    private readonly templateService: EmailTemplateService,
  ) {
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

  async sendWelcome(to: string, data: WelcomeEmailData): Promise<void> {
    const html = this.templateService.renderWelcome(data);
    await this.send(
      to,
      `Senkronize'a Hoşgeldiniz, ${data.name}! 🎉`,
      html,
    );
  }

  async sendOrderNew(to: string, data: OrderEmailData): Promise<void> {
    const html = this.templateService.renderOrderNew(data);
    await this.send(
      to,
      `Yeni Sipariş: #${data.orderNumber} - ${data.platform}`,
      html,
    );
  }

  async sendLowStockAlert(to: string, data: LowStockEmailData): Promise<void> {
    const html = this.templateService.renderLowStock(data);
    await this.send(
      to,
      `⚠️ ${data.count} Ürününüzde Stok Kritik Seviyede`,
      html,
    );
  }

  async sendCriticalStockForecastAlert(
    to: string,
    data: CriticalStockForecastEmailData,
  ): Promise<void> {
    const html = this.templateService.renderCriticalStockForecast(data);
    await this.send(
      to,
      `Stok tahmini: ${String(data.count)} ürün 7 günden az süreyle`,
      html,
    );
  }

  async sendTrialExpiring(to: string, data: TrialExpiringData): Promise<void> {
    const html = this.templateService.renderTrialExpiring(data);
    await this.send(
      to,
      `Deneme Süreniz ${data.daysLeft} Gün İçinde Sona Eriyor`,
      html,
    );
  }

  async sendSubscriptionPlanChanged(
    to: string,
    data: PlanChangedData,
  ): Promise<void> {
    const html = this.templateService.renderPlanChanged(data);
    await this.send(
      to,
      `Planınız ${data.newPlanLabel} Olarak Güncellendi`,
      html,
    );
  }

  async sendPartnerInvite(to: string, data: PartnerInviteData): Promise<void> {
    const html = this.templateService.renderPartnerInvite(data);
    await this.send(
      to,
      `${data.partnerName} Sizi Senkronize'a Davet Ediyor`,
      html,
    );
  }

  async sendOrganizationUserInvite(
    to: string,
    data: { organizationName: string; inviteUrl: string },
  ): Promise<void> {
    const safeOrg = data.organizationName
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    await this.send(
      to,
      `${data.organizationName} sizi Senkronize ekibine davet ediyor`,
      `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <h2>Organizasyon daveti</h2>
        <p><strong>${safeOrg}</strong> sizi panele davet etti.</p>
        <p>Bu bağlantı 48 saat geçerlidir. Hesabınızı oluşturmak veya mevcut hesabınızla katılmak için aşağıdaki düğmeyi kullanın.</p>
        <a href="${data.inviteUrl.replace(/"/g, '%22')}"
           style="background:#0ea5e9;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin-top:16px">
          Daveti kabul et
        </a>
        <p style="color:#666;font-size:13px;margin-top:24px">Bağlantı çalışmıyorsa şu adresi tarayıcıya yapıştırın:<br/>${data.inviteUrl.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</p>
      </div>
    `,
    );
  }

  async sendInvoice(to: string, data: InvoiceEmailData): Promise<void> {
    const html = this.templateService.renderInvoice(data);
    await this.send(
      to,
      `Ödeme Onaylandı - ${data.planName} Planı`,
      html,
    );
  }

  async sendSubscriptionCancelled(
    to: string,
    name: string,
    accessUntil: Date,
  ): Promise<void> {
    const base = this.panelBaseUrl();
    await this.send(
      to,
      'Abonelik iptal talebiniz alındı',
      `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <h2>Merhaba ${name},</h2>
        <p>Abonelik iptal talebiniz kaydedildi.</p>
        <p><strong>${accessUntil.toLocaleDateString('tr-TR')}</strong> tarihine kadar mevcut paketinizle erişiminiz devam eder.</p>
        <a href="${base}/settings/subscription"
           style="background:#6366f1;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin-top:16px">
          Abonelik Ayarları
        </a>
      </div>
    `,
    );
  }

  async sendSubscriptionConfirm(
    to: string,
    data: InvoiceEmailData,
  ): Promise<void> {
    await this.sendInvoice(to, data);
  }

  async sendOutOfStockWeeklyReport(
    to: string,
    name: string,
    totalZeroStock: number,
    sampleProductNames: string[],
  ): Promise<void> {
    const samples =
      sampleProductNames.length > 0
        ? `<ul style="padding-left:18px">${sampleProductNames
            .map((n) => `<li style="margin-bottom:4px">${n}</li>`)
            .join('')}</ul>`
        : '<p>Örnek listelenemedi.</p>';
    await this.send(
      to,
      `Haftalık stok özeti: ${totalZeroStock} listelemede stok sıfır`,
      `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <h2>Merhaba ${name},</h2>
        <p>Stoku <strong>0</strong> olan <strong>${totalZeroStock}</strong> pazaryeri listelemeniz var.</p>
        <p>Örnek ürünler:</p>
        ${samples}
        <p style="color:#666;font-size:14px">Panele giriş yaparak stoklarınızı güncelleyebilirsiniz.</p>
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

  async sendPurchaseOrderToSupplier(
    to: string,
    data: {
      supplierName: string;
      orderNumber: string;
      organizationName: string;
      currency: string;
      totalAmount: string;
      itemLines: string[];
      notes: string | null;
    },
  ): Promise<void> {
    const esc = (s: string): string =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const lines = data.itemLines.map((l) => `<li>${esc(l)}</li>`).join('');
    const notesBlock =
      data.notes && data.notes.trim().length > 0
        ? `<p><strong>Not:</strong> ${esc(data.notes.trim())}</p>`
        : '';
    await this.send(
      to,
      `Satın alma siparişi ${data.orderNumber} — ${data.organizationName}`,
      `
      <div style="font-family:sans-serif;max-width:640px;margin:0 auto">
        <h2>Merhaba ${esc(data.supplierName)},</h2>
        <p><strong>${esc(data.organizationName)}</strong> aşağıdaki satın alma siparişini iletmiştir.</p>
        <p><strong>Sipariş no:</strong> ${esc(data.orderNumber)}</p>
        <p><strong>Toplam:</strong> ${esc(data.totalAmount)} ${esc(data.currency)}</p>
        ${notesBlock}
        <h3>Kalemler</h3>
        <ul style="padding-left:20px">${lines}</ul>
        <p style="color:#666;font-size:13px;margin-top:24px">Bu mesaj Senkronize paneli üzerinden otomatik gönderilmiştir.</p>
      </div>
    `,
    );
  }

  async sendAccountLockNotification(to: string): Promise<void> {
    const base = this.panelBaseUrl();
    await this.send(
      to,
      'Hesap güvenliği: geçici kilit',
      `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <h2>Çok sayıda başarısız giriş denemesi</h2>
        <p>Güvenliğiniz için hesabınız geçici olarak kilitlendi (yaklaşık 15 dakika).</p>
        <p>Şifrenizi unuttuysanız paneldeki şifre sıfırlama akışını kullanabilirsiniz.</p>
        <a href="${base}/auth/login"
           style="background:#0ea5e9;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin-top:16px">
          Panele git
        </a>
      </div>
    `,
    );
  }

  async sendNewIpLoginAlert(to: string, ip: string): Promise<void> {
    const safeIp = ip
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    const base = this.panelBaseUrl();
    await this.send(
      to,
      'Yeni IP adresinden giriş',
      `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <h2>Hesabınıza yeni bir IP üzerinden giriş yapıldı</h2>
        <p><strong>IP:</strong> ${safeIp}</p>
        <p>Bu sizseniz bu mesajı yok sayabilirsiniz. Tanımadığınız bir aktiviteyse şifrenizi değiştirin.</p>
        <a href="${base}/settings/security"
           style="background:#0ea5e9;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin-top:16px">
          Güvenlik ayarları
        </a>
      </div>
    `,
    );
  }

  async sendNewTicketNotification(
    email: string,
    ticketNumber: string,
    subject: string,
  ): Promise<void> {
    const esc = (s: string): string =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const supportUrl = `${this.panelBaseUrl()}/support`;
    await this.send(
      email,
      `Destek talebiniz alındı: ${ticketNumber}`,
      `
      <div style="font-family:sans-serif;max-width:640px;margin:0 auto">
        <h2>Destek talebiniz oluşturuldu</h2>
        <p><strong>Talep no:</strong> ${esc(ticketNumber)}</p>
        <p><strong>Konu:</strong> ${esc(subject)}</p>
        <p>Ekibimiz en kısa sürede size dönüş yapacaktır.</p>
        <a href="${esc(supportUrl)}"
           style="background:#0ea5e9;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin-top:16px">
          Taleplerimi görüntüle
        </a>
      </div>
    `,
    );
  }

  async sendTicketReplyNotification(
    email: string,
    ticketNumber: string,
  ): Promise<void> {
    const esc = (s: string): string =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const supportUrl = `${this.panelBaseUrl()}/support`;
    await this.send(
      email,
      `Destek talebinize yanıt: ${ticketNumber}`,
      `
      <div style="font-family:sans-serif;max-width:640px;margin:0 auto">
        <h2>Destek ekibinden yanıt</h2>
        <p><strong>Talep no:</strong> ${esc(ticketNumber)}</p>
        <p>Destek ekibimiz talebinize yanıt verdi. Detayları panelden görüntüleyebilirsiniz.</p>
        <a href="${esc(supportUrl)}"
           style="background:#0ea5e9;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin-top:16px">
          Talebi aç
        </a>
      </div>
    `,
    );
  }

  async sendTicketStatusUpdate(
    email: string,
    ticketNumber: string,
    status: string,
  ): Promise<void> {
    const esc = (s: string): string =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const statusLabels: Record<string, string> = {
      OPEN: 'Açık',
      IN_PROGRESS: 'İşlemde',
      WAITING_CUSTOMER: 'Müşteri Bekleniyor',
      RESOLVED: 'Çözüldü',
      CLOSED: 'Kapalı',
    };
    const statusLabel = statusLabels[status] ?? status;
    const supportUrl = `${this.panelBaseUrl()}/support`;
    await this.send(
      email,
      `Talep durumu güncellendi: ${ticketNumber}`,
      `
      <div style="font-family:sans-serif;max-width:640px;margin:0 auto">
        <h2>Talep durumu güncellendi</h2>
        <p><strong>Talep no:</strong> ${esc(ticketNumber)}</p>
        <p><strong>Yeni durum:</strong> ${esc(statusLabel)}</p>
        <a href="${esc(supportUrl)}"
           style="background:#0ea5e9;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin-top:16px">
          Talebi görüntüle
        </a>
      </div>
    `,
    );
  }

  async sendSupportTicketCreated(
    to: string,
    data: {
      userName: string;
      ticketNumber: string;
      subject: string;
      ticketUrl: string;
    },
  ): Promise<void> {
    const esc = (s: string): string =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    await this.send(
      to,
      `Destek talebiniz alındı: ${data.ticketNumber}`,
      `
      <div style="font-family:sans-serif;max-width:640px;margin:0 auto">
        <h2>Merhaba ${esc(data.userName)},</h2>
        <p>Destek talebiniz başarıyla oluşturuldu.</p>
        <p><strong>Talep no:</strong> ${esc(data.ticketNumber)}</p>
        <p><strong>Konu:</strong> ${esc(data.subject)}</p>
        <a href="${esc(data.ticketUrl)}"
           style="background:#0ea5e9;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin-top:16px">
          Talebi görüntüle
        </a>
      </div>
    `,
    );
  }

  async sendSupportTicketAdminAlert(
    to: string,
    data: {
      ticketNumber: string;
      subject: string;
      organizationName: string;
      userName: string;
      userEmail: string;
      priority: string;
      adminUrl: string;
    },
  ): Promise<void> {
    const esc = (s: string): string =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    await this.send(
      to,
      `Yeni destek talebi: ${data.ticketNumber}`,
      `
      <div style="font-family:sans-serif;max-width:640px;margin:0 auto">
        <h2>Yeni destek talebi</h2>
        <p><strong>No:</strong> ${esc(data.ticketNumber)}</p>
        <p><strong>Konu:</strong> ${esc(data.subject)}</p>
        <p><strong>Öncelik:</strong> ${esc(data.priority)}</p>
        <p><strong>Organizasyon:</strong> ${esc(data.organizationName)}</p>
        <p><strong>Kullanıcı:</strong> ${esc(data.userName)} (${esc(data.userEmail)})</p>
        <a href="${esc(data.adminUrl)}"
           style="background:#0ea5e9;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin-top:16px">
          Admin panelde aç
        </a>
      </div>
    `,
    );
  }

  async sendSupportTicketCustomerReplyAlert(
    to: string,
    data: {
      ticketNumber: string;
      subject: string;
      organizationName: string;
      userName: string;
      adminUrl: string;
    },
  ): Promise<void> {
    const esc = (s: string): string =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    await this.send(
      to,
      `Müşteri yanıtı: ${data.ticketNumber}`,
      `
      <div style="font-family:sans-serif;max-width:640px;margin:0 auto">
        <h2>Müşteri yanıt verdi</h2>
        <p><strong>No:</strong> ${esc(data.ticketNumber)}</p>
        <p><strong>Konu:</strong> ${esc(data.subject)}</p>
        <p><strong>Organizasyon:</strong> ${esc(data.organizationName)}</p>
        <p><strong>Kullanıcı:</strong> ${esc(data.userName)}</p>
        <a href="${esc(data.adminUrl)}"
           style="background:#0ea5e9;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin-top:16px">
          Yanıtla
        </a>
      </div>
    `,
    );
  }

  async sendSupportStaleTicketsReminder(
    to: string,
    data: {
      count: number;
      tickets: {
        ticketNumber: string;
        subject: string;
        organizationName: string;
        daysWaiting: number;
      }[];
      adminUrl: string;
    },
  ): Promise<void> {
    const esc = (s: string): string =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const rows = data.tickets
      .map(
        (t) =>
          `<li><strong>${esc(t.ticketNumber)}</strong> — ${esc(t.subject)} (${esc(t.organizationName)}, ${String(t.daysWaiting)} gün)</li>`,
      )
      .join('');
    await this.send(
      to,
      `${String(data.count)} bekleyen destek talebi`,
      `
      <div style="font-family:sans-serif;max-width:640px;margin:0 auto">
        <h2>Bekleyen destek talepleri</h2>
        <p>${String(data.count)} talep 3 günden uzun süredir yanıt bekliyor:</p>
        <ul style="padding-left:20px">${rows}</ul>
        <a href="${esc(data.adminUrl)}"
           style="background:#0ea5e9;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin-top:16px">
          Tüm talepleri gör
        </a>
      </div>
    `,
    );
  }

  async sendEventEmail(to: string, event: NotificationEvent): Promise<void> {
    const base = this.panelBaseUrl();
    const link = event.link
      ? `${base}${event.link.startsWith('/') ? event.link : `/${event.link}`}`
      : base;
    const esc = (s: string): string =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    await this.send(
      to,
      event.title,
      `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <h2>${esc(event.title)}</h2>
        <p>${esc(event.message)}</p>
        <a href="${esc(link)}"
           style="background:#38bdf8;color:#0f172a;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin-top:16px;font-weight:600">
          Panele Git
        </a>
      </div>
    `,
    );
  }

  async sendDigestEmail(
    to: string,
    data: {
      period: string;
      notifications: {
        eventType: string;
        title: string;
        message: string;
        link: string | null;
        createdAt: Date;
      }[];
    },
  ): Promise<void> {
    const rows = data.notifications.map((n) => ({
      eventType: n.eventType,
      title: n.title,
      message: n.message,
      link: n.link,
      createdAt: n.createdAt.toLocaleString('tr-TR', {
        dateStyle: 'short',
        timeStyle: 'short',
      }),
    }));
    const digestData = this.templateService.buildDigestEmailData(
      'Merhaba',
      data.period,
      rows,
    );
    const html = this.templateService.renderDigest(digestData);
    const subject =
      data.period === 'weekly'
        ? 'Haftalık bildirim özeti — Senkronize'
        : 'Günlük bildirim özeti — Senkronize';
    await this.send(to, subject, html);
  }

  async sendTestNotification(to: string): Promise<void> {
    await this.send(
      to,
      'Senkronize test bildirimi',
      `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <h2>Test e-postası</h2>
        <p>Bildirim ayarlarınız çalışıyor. Bu bir test mesajıdır.</p>
        <a href="${this.panelBaseUrl()}/settings"
           style="background:#38bdf8;color:#0f172a;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin-top:16px;font-weight:600">
          Ayarlara dön
        </a>
      </div>
    `,
    );
  }

  async sendApiAnomalyAlert(to: string, organizationId: string): Promise<void> {
    const safeOrg = organizationId
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    await this.send(
      to,
      'API kullanım uyarısı',
      `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <h2>Olağandışı API trafiği</h2>
        <p>Organizasyon <code>${safeOrg}</code> için dakikalık istek eşiği aşıldı.</p>
        <p>Otomasyon veya entegrasyonlarınızı gözden geçirmenizi öneririz.</p>
      </div>
    `,
    );
  }
}
