import {
  Body,
  Controller,
  ForbiddenException,
  Headers,
  HttpCode,
  Logger,
  Post,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle } from '@nestjs/throttler';

import { SubscriptionService } from '../subscription/subscription.service';
import { verifyIyzicoSubscriptionWebhookSignature } from './iyzico-webhook.signature';
import type { IyzicoWebhookPayload } from './iyzico.types';
import { IyzicoService } from './iyzico.service';

@Controller('payment')
export class PaymentWebhookController {
  private readonly logger = new Logger(PaymentWebhookController.name);

  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly iyzicoService: IyzicoService,
    private readonly config: ConfigService,
  ) {}

  @Post('webhooks/iyzico')
  @HttpCode(200)
  @SkipThrottle()
  async handleIyzicoWebhook(
    @Body() body: IyzicoWebhookPayload,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ): Promise<{ received: boolean }> {
    const signature = this.headerValue(headers, 'x-iyz-signature-v3');
    const appEnv = this.config.get<string>('APP_ENV') ?? 'development';
    const skipVerify =
      appEnv === 'development' &&
      this.config.get<string>('IYZICO_WEBHOOK_SKIP_VERIFY') === '1';

    if (!skipVerify) {
      const valid = verifyIyzicoSubscriptionWebhookSignature(
        body,
        signature,
        this.iyzicoService.getSecretKey(),
        this.iyzicoService.getMerchantId(),
      );
      if (!valid) {
        this.logger.warn('Iyzico webhook imza doğrulaması başarısız');
        throw new ForbiddenException();
      }
    }

    await this.subscriptionService.handleIyzicoWebhook(body);
    return { received: true };
  }

  private headerValue(
    headers: Record<string, string | string[] | undefined>,
    name: string,
  ): string | undefined {
    const direct = headers[name];
    if (typeof direct === 'string') {
      return direct;
    }
    const lower = headers[name.toLowerCase()];
    if (typeof lower === 'string') {
      return lower;
    }
    if (Array.isArray(lower) && lower[0]) {
      return lower[0];
    }
    return undefined;
  }
}
