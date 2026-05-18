import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly username: string;
  private readonly password: string;
  private readonly sender: string;

  constructor(private readonly config: ConfigService) {
    this.username =
      this.config.get<string>('NETGSM_USERNAME')?.trim() ||
      this.config.get<string>('NETGSM_USERCODE')?.trim() ||
      '';
    this.password = this.config.get<string>('NETGSM_PASSWORD') ?? '';
    this.sender =
      this.config.get<string>('NETGSM_SENDER')?.trim() ||
      this.config.get<string>('NETGSM_HEADER')?.trim() ||
      'SENKRONIZE';
  }

  async send(to: string, message: string): Promise<void> {
    if (!this.username || this.username === 'placeholder') {
      this.logger.warn(`[SMS MOCK] To: ${to} | Message: ${message}`);
      return;
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<mainbody>
  <header>
    <company>Netgsm</company>
    <usercode>${this.username}</usercode>
    <password>${this.password}</password>
    <type>1:n</type>
    <msgheader>${this.sender}</msgheader>
  </header>
  <body>
    <msg><![CDATA[${message}]]></msg>
    <no>${to}</no>
  </body>
</mainbody>`;

    try {
      const { data } = await axios.post<string>('https://api.netgsm.com.tr/sms/send/xml', xml, {
        headers: { 'Content-Type': 'text/xml' },
        timeout: 10_000,
      });
      if (!String(data).startsWith('00')) {
        this.logger.warn(`Netgsm SMS gönderim uyarısı: ${data}`);
      }
    } catch (e) {
      this.logger.error(`SMS send failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async sendOrderAlert(to: string, orderCount: number, platform: string): Promise<void> {
    await this.send(
      to,
      `Senkronize: ${platform} platformunda ${orderCount} yeni sipariş geldi. Panel: app.senkronize.com`,
    );
  }

  async sendLowStockAlert(to: string, productName: string, stock: number): Promise<void> {
    await this.send(
      to,
      `Senkronize: "${productName}" ürününün stoğu kritik seviyede (${stock} adet). Panel: app.senkronize.com`,
    );
  }

  async sendWelcome(to: string, name: string): Promise<void> {
    await this.send(
      to,
      `Merhaba ${name}! Senkronize'a hoş geldiniz. 14 gün ücretsiz deneme başladı. app.senkronize.com`,
    );
  }
}
