import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { TrialService } from './trial.service';

@Injectable()
export class TrialExpiryTask {
  private readonly logger = new Logger(TrialExpiryTask.name);

  constructor(private readonly trialService: TrialService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async checkExpiredTrials(): Promise<void> {
    await this.trialService.processExpiredTrials();
  }

  @Cron('0 9 * * *')
  async notifyTrialsEndingSoon(): Promise<void> {
    await this.trialService.notifyTrialsEndingSoon();
  }
}
