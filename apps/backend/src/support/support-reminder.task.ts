import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { SupportService } from './support.service';

@Injectable()
export class SupportReminderTask {
  private readonly logger = new Logger(SupportReminderTask.name);

  constructor(private readonly supportService: SupportService) {}

  /** 3 günden uzun yanıtsız açık talepler için ops hatırlatması */
  @Cron('0 9 * * *')
  async remindStaleTickets(): Promise<void> {
    try {
      await this.supportService.sendStaleTicketReminders();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Bekleyen ticket hatırlatması başarısız: ${message}`);
    }
  }

  /** 48 saat yanıtsız talepleri URGENT önceliğe yükselt */
  @Cron('0 */6 * * *')
  async escalateUnansweredTickets(): Promise<void> {
    try {
      await this.supportService.escalateUnansweredTickets();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Ticket öncelik yükseltme başarısız: ${message}`);
    }
  }

  /** 7 gün hareketsiz talepleri otomatik kapat */
  @Cron('0 3 * * *')
  async autoCloseInactiveTickets(): Promise<void> {
    try {
      await this.supportService.autoCloseInactiveTickets();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Ticket otomatik kapatma başarısız: ${message}`);
    }
  }
}
