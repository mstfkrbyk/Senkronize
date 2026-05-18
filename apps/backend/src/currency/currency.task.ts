import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { CurrencyService } from './currency.service';

@Injectable()
export class CurrencyTask {
  private readonly logger = new Logger(CurrencyTask.name);

  constructor(private readonly currencyService: CurrencyService) {}

  /** Her gün 10:00 — TCMB kurlarını çek ve Redis önbelleğini yenile (24 saat TTL). */
  @Cron('0 10 * * *')
  async fetchDailyTcmb(): Promise<void> {
    try {
      await this.currencyService.fetchTCMBRates();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('TCMB günlük kur görevi başarısız', { message });
    }
  }
}
