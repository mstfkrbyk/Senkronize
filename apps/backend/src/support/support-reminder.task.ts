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
}
