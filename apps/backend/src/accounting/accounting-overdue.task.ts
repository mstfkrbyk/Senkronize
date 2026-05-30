import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { AccountingOverdueService } from './accounting-overdue.service';

@Injectable()
export class AccountingOverdueTask {
  private readonly logger = new Logger(AccountingOverdueTask.name);

  constructor(private readonly accountingOverdueService: AccountingOverdueService) {}

  /** Her gün 01:00 — vadesi geçmiş SENT faturaları OVERDUE yapar */
  @Cron('0 1 * * *')
  async markOverdueInvoices(): Promise<void> {
    try {
      await this.accountingOverdueService.markOverdueSentInvoices();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Vadesi geçen fatura görevi başarısız', { message });
    }
  }
}
