import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Header,
  HttpCode,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle } from '@nestjs/throttler';
import type { Subscription } from '@prisma/client';
import type { PlanTier } from '@prisma/client';
import type { Request } from 'express';

import { SuperAdminGuard } from '../admin/admin.guard';
import { CurrentOrg, CurrentOrgPayload } from '../auth/current-org.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PaytrService } from './paytr.service';
import { isPaytrWebhookIpAllowed } from './paytr-webhook-ip';
import type { PaytrWebhookPayload } from './paytr.types';
import {
  IyzicoCallbackDto,
  SubscriptionCancelDto,
  SubscriptionChangePlanDto,
  SubscriptionCheckoutDto,
  SubscriptionPaymentsQueryDto,
  SubscriptionStartDto,
  TrialExtendDto,
} from './subscription.dto';
import { SubscriptionService } from './subscription.service';
import { TrialService } from './trial.service';
import type {
  CheckoutUrlResult,
  PlanUpgradeRequestResult,
  UsageOverview,
} from './subscription.types';

function getClientIp(req: Request): string {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string') {
    return xff.split(',')[0].trim();
  }
  const raw = req.socket.remoteAddress ?? '';
  return raw.replace(/^::ffff:/, '');
}

function coerceWebhookPayload(body: unknown): PaytrWebhookPayload {
  if (!body || typeof body !== 'object') {
    throw new ForbiddenException();
  }
  const b = body as Record<string, unknown>;
  const merchant_oid = String(b.merchant_oid ?? '');
  const status = String(b.status ?? '') as PaytrWebhookPayload['status'];
  const total_amount = String(b.total_amount ?? '');
  const hash = String(b.hash ?? '');
  if (!merchant_oid || !hash || (status !== 'success' && status !== 'failed')) {
    throw new ForbiddenException();
  }
  return {
    merchant_oid,
    status,
    total_amount,
    hash,
    payment_type: b.payment_type != null ? String(b.payment_type) : undefined,
    currency: b.currency != null ? String(b.currency) : undefined,
    test_mode: b.test_mode != null ? String(b.test_mode) : undefined,
    payment_amount:
      b.payment_amount != null ? String(b.payment_amount) : undefined,
    failed_reason_code:
      b.failed_reason_code != null ? String(b.failed_reason_code) : undefined,
    failed_reason_msg:
      b.failed_reason_msg != null ? String(b.failed_reason_msg) : undefined,
    fail_reason_code:
      b.fail_reason_code != null ? String(b.fail_reason_code) : undefined,
    fail_reason_msg:
      b.fail_reason_msg != null ? String(b.fail_reason_msg) : undefined,
    recurring_id: b.recurring_id != null ? String(b.recurring_id) : undefined,
    card_type: b.card_type != null ? String(b.card_type) : undefined,
    utoken: b.utoken != null ? String(b.utoken) : undefined,
    ctoken: b.ctoken != null ? String(b.ctoken) : undefined,
  };
}

@Controller(['subscriptions', 'subscription'])
export class SubscriptionController {
  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly trialService: TrialService,
    private readonly paytrService: PaytrService,
    private readonly config: ConfigService,
  ) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentOrg() org: CurrentOrgPayload): Promise<Subscription> {
    return this.subscriptionService.getSubscription(org.id);
  }

  @Get('usage')
  @UseGuards(JwtAuthGuard)
  async usage(@CurrentOrg() org: CurrentOrgPayload): Promise<UsageOverview> {
    return this.subscriptionService.getUsageOverview(org.id);
  }

  @Post('change-plan')
  @UseGuards(JwtAuthGuard)
  async changePlan(
    @CurrentOrg() org: CurrentOrgPayload,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SubscriptionChangePlanDto,
  ): Promise<Subscription> {
    return this.subscriptionService.changePlan(org.id, user.id, dto.plan);
  }

  @Post('start')
  @UseGuards(JwtAuthGuard)
  async startSubscription(
    @CurrentOrg() org: CurrentOrgPayload,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SubscriptionStartDto,
  ): Promise<CheckoutUrlResult> {
    return this.subscriptionService.startSubscription(
      org.id,
      user,
      dto.plan,
      dto.billingPeriod,
    );
  }

  @Post('iyzico/callback')
  @UseGuards(JwtAuthGuard)
  async iyzicoCallback(
    @CurrentOrg() org: CurrentOrgPayload,
    @Body() dto: IyzicoCallbackDto,
  ): Promise<{ success: boolean; message: string; plan?: PlanTier }> {
    return this.subscriptionService.completeIyzicoCheckout(org.id, dto.token);
  }

  @Patch('plan')
  @UseGuards(JwtAuthGuard)
  async requestPlanUpgradeLegacy(
    @CurrentOrg() org: CurrentOrgPayload,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SubscriptionChangePlanDto,
  ): Promise<PlanUpgradeRequestResult> {
    return this.subscriptionService.upgradeSubscription(
      org.id,
      user.id,
      dto.plan,
    );
  }

  @Post('upgrade')
  @UseGuards(JwtAuthGuard)
  async upgrade(
    @CurrentOrg() org: CurrentOrgPayload,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SubscriptionChangePlanDto,
  ): Promise<PlanUpgradeRequestResult> {
    return this.subscriptionService.upgradeSubscription(
      org.id,
      user.id,
      dto.plan,
    );
  }

  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  async checkout(
    @CurrentOrg() org: CurrentOrgPayload,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SubscriptionCheckoutDto,
    @Req() req: Request,
  ): Promise<{ iframeToken: string; merchantOid: string; token: string }> {
    const userIp = getClientIp(req);
    const result = await this.subscriptionService.createCheckoutToken(
      org.id,
      user,
      dto.plan,
      userIp,
    );
    return { ...result, token: result.iframeToken };
  }

  @Post('cancel')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  async cancel(
    @CurrentOrg() org: CurrentOrgPayload,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SubscriptionCancelDto,
  ): Promise<void> {
    await this.subscriptionService.cancelSubscription(
      org.id,
      user.id,
      dto.reason,
    );
  }

  @Post('reactivate')
  @UseGuards(JwtAuthGuard)
  async reactivate(
    @CurrentOrg() org: CurrentOrgPayload,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Subscription> {
    return this.subscriptionService.reactivateSubscription(org.id, user.id);
  }

  @Post('trial/extend')
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  async extendTrial(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: TrialExtendDto,
  ): Promise<{ trialEndsAt: string }> {
    const result = await this.trialService.extendTrial(
      dto.organizationId,
      user.id,
      dto.days ?? 7,
    );
    return { trialEndsAt: result.trialEndsAt.toISOString() };
  }

  @Get('payments')
  @UseGuards(JwtAuthGuard)
  async payments(
    @CurrentOrg() org: CurrentOrgPayload,
    @Query() query: SubscriptionPaymentsQueryDto,
  ): Promise<unknown> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    return this.subscriptionService.getPaymentHistory(org.id, page, limit);
  }

  @Get('invoices')
  @UseGuards(JwtAuthGuard)
  async invoices(
    @CurrentOrg() org: CurrentOrgPayload,
    @Query() query: SubscriptionPaymentsQueryDto,
  ): Promise<unknown> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    return this.subscriptionService.getInvoiceList(org.id, page, limit);
  }

  @Post('webhook')
  @HttpCode(200)
  @Header('Content-Type', 'text/plain; charset=utf-8')
  @SkipThrottle()
  async webhook(
    @Req() req: Request,
    @Body() body: Record<string, unknown>,
  ): Promise<string> {
    const ip = getClientIp(req);
    const appEnv = this.config.get<string>('APP_ENV') ?? 'development';
    const allowLocalWebhook =
      appEnv === 'development' &&
      (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1');
    const allowlist = this.config.get<string>('PAYTR_WEBHOOK_IPS');
    if (!allowLocalWebhook && !isPaytrWebhookIpAllowed(ip, allowlist)) {
      throw new ForbiddenException();
    }

    const payload = coerceWebhookPayload(body);
    if (!this.paytrService.verifyWebhookHash(payload)) {
      throw new ForbiddenException();
    }

    await this.subscriptionService.handleWebhook(payload);
    return 'OK';
  }
}
