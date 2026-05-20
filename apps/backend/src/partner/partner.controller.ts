import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { PartnerRelationship } from '@prisma/client';

import { CurrentOrg, CurrentOrgPayload } from '../auth/current-org.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public } from '../auth/public.decorator';

import {
  AcceptInviteDto,
  InviteClientDto,
  PartnerOnboardingInviteDto,
  PartnerPayoutRequestDto,
  UpdateRelationshipDto,
  UpdateWhiteLabelDto,
  ValidatePartnerInviteDto,
} from './partner.dto';
import { PartnerLinkRequestDto } from './partner.dto';
import { PartnerLinkService } from './partner-link.service';
import { PartnerService } from './partner.service';

@ApiTags('partner')
@ApiBearerAuth()
@Controller('partner')
@UseGuards(JwtAuthGuard)
export class PartnerController {
  constructor(
    private readonly partnerService: PartnerService,
    private readonly partnerLinkService: PartnerLinkService,
  ) {}

  @Post('validate-invite')
  @Public()
  @ApiOperation({ summary: 'Müşteri davet kodunu doğrula (JWT gerekmez)' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 400 })
  @ApiResponse({ status: 404 })
  async validateInvite(
    @Body() dto: ValidatePartnerInviteDto,
  ): Promise<Awaited<ReturnType<PartnerService['validateInviteToken']>>> {
    return this.partnerService.validateInviteToken(dto.token);
  }

  @Post('invite')
  @ApiOperation({ summary: 'Müşteri onboarding daveti (kayıt bağlantısı)' })
  @ApiResponse({ status: 201 })
  async createOnboardingInvite(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: PartnerOnboardingInviteDto,
  ): Promise<Awaited<ReturnType<PartnerService['inviteClient']>>> {
    return this.partnerService.inviteClient(
      user.organizationId,
      dto.email,
      dto.message,
    );
  }

  @Get('invites')
  @ApiOperation({ summary: 'Onboarding davet listesi' })
  @ApiResponse({ status: 200 })
  async listOnboardingInvites(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Awaited<ReturnType<PartnerService['getInvites']>>> {
    return this.partnerService.getInvites(user.organizationId);
  }

  @Post('invites/:id/resend')
  @ApiOperation({ summary: 'Onboarding davetini yeniden gönder' })
  @ApiResponse({ status: 201 })
  async resendOnboardingInvite(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<{ inviteUrl: string }> {
    return this.partnerService.resendClientInvite(user.organizationId, id);
  }

  @Get('commission-report')
  @ApiOperation({ summary: 'Aylık komisyon raporu' })
  @ApiResponse({ status: 200 })
  async commissionReport(
    @CurrentUser() user: AuthenticatedUser,
    @Query('year', new DefaultValuePipe(new Date().getFullYear()), ParseIntPipe)
    year: number,
    @Query(
      'month',
      new DefaultValuePipe(new Date().getMonth() + 1),
      ParseIntPipe,
    )
    month: number,
  ): Promise<Awaited<ReturnType<PartnerService['getCommissionReport']>>> {
    return this.partnerService.getCommissionReport(
      user.organizationId,
      year,
      month,
    );
  }

  @Get('performance')
  @ApiOperation({ summary: 'Partner performans özeti' })
  @ApiResponse({ status: 200 })
  async partnerPerformance(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Awaited<ReturnType<PartnerService['getPartnerPerformance']>>> {
    return this.partnerService.getPartnerPerformance(user.organizationId);
  }

  @Get('white-label')
  @ApiOperation({ summary: 'Beyaz etiket ayarları' })
  @ApiResponse({ status: 200 })
  async getWhiteLabel(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Awaited<ReturnType<PartnerService['getWhiteLabelSettings']>>> {
    return this.partnerService.getWhiteLabelSettings(user.organizationId);
  }

  @Put('white-label')
  @ApiOperation({ summary: 'Beyaz etiket ayarlarını güncelle' })
  @ApiResponse({ status: 200 })
  async putWhiteLabel(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateWhiteLabelDto,
  ): Promise<Awaited<ReturnType<PartnerService['updateWhiteLabelSettings']>>> {
    return this.partnerService.updateWhiteLabelSettings(
      user.organizationId,
      dto,
    );
  }

  @Post('payout-request')
  @ApiOperation({ summary: 'Ödeme talebi oluştur' })
  @ApiResponse({ status: 201 })
  async payoutRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: PartnerPayoutRequestDto,
  ): Promise<{ success: true }> {
    await this.partnerService.requestPayout(
      user.organizationId,
      user.id,
      dto.amount,
    );
    return { success: true };
  }

  @Get('clients')
  @ApiOperation({ summary: 'Partner müşteri listesi' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 403 })
  async getClients(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Awaited<ReturnType<PartnerService['getMyClients']>>> {
    return this.partnerService.getMyClients(user.organizationId);
  }

  @Post('clients/invite')
  @ApiOperation({ summary: 'Müşteri davet et' })
  @ApiResponse({ status: 201 })
  async inviteClientRelationship(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: InviteClientDto,
  ): Promise<{ inviteUrl: string }> {
    return this.partnerService.inviteClientRelationship(
      user.organizationId,
      dto,
    );
  }

  @Get('clients/:clientOrgId')
  @ApiOperation({ summary: 'Müşteri özeti (partner erişimi)' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 403 })
  async getClientDetail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clientOrgId') clientOrgId: string,
  ): Promise<Awaited<ReturnType<PartnerService['getClientDetail']>>> {
    return this.partnerService.getClientDetail(
      user.organizationId,
      clientOrgId,
    );
  }

  @Post('clients/:clientOrgId/access')
  @ApiOperation({ summary: 'Müşteri hesabına geçiş tokenı' })
  @ApiResponse({ status: 200 })
  async accessClient(
    @CurrentUser() user: AuthenticatedUser,
    @Param('clientOrgId') clientOrgId: string,
  ): Promise<{ impersonationToken: string; expiresIn: number }> {
    if (user.isImpersonating) {
      throw new ForbiddenException(
        'Zaten müşteri adına oturum açık; önce normal oturuma dönün.',
      );
    }
    return this.partnerService.startClientAccess(
      user.organizationId,
      clientOrgId,
      user.id,
      user.role,
    );
  }

  @Delete('clients/:id')
  @ApiOperation({ summary: 'Müşteri ilişkisini sonlandır (partner)' })
  @ApiResponse({ status: 200 })
  async terminateClient(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<{ success: true }> {
    await this.partnerService.terminateRelationship(user.organizationId, id);
    return { success: true };
  }

  @Patch('clients/:id')
  @ApiOperation({ summary: 'Müşteri ilişkisini güncelle (partner)' })
  @ApiResponse({ status: 200 })
  async updateClient(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateRelationshipDto,
  ): Promise<PartnerRelationship> {
    return this.partnerService.updateRelationship(
      user.organizationId,
      id,
      dto,
    );
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Partner paneli özeti' })
  @ApiResponse({ status: 200 })
  async getPartnerDashboard(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Awaited<ReturnType<PartnerService['getDashboard']>>> {
    return this.partnerService.getDashboard(user.organizationId);
  }

  @Get('commissions')
  @ApiOperation({ summary: 'Komisyon geçmişi (sayfalı)' })
  @ApiResponse({ status: 200 })
  async getCommissions(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ): Promise<Awaited<ReturnType<PartnerService['getCommissions']>>> {
    return this.partnerService.getCommissions(
      user.organizationId,
      page,
      limit,
    );
  }

  @Get('commission')
  @ApiOperation({ summary: 'Komisyon özeti ve defter' })
  @ApiResponse({ status: 200 })
  async getCommission(@CurrentUser() user: AuthenticatedUser) {
    return this.partnerService.getCommissionSummary(user.organizationId);
  }

  @Get('my-partners')
  @ApiOperation({ summary: 'Organizasyonun bağlı olduğu partnerler' })
  @ApiResponse({ status: 200 })
  async getMyPartners(
    @CurrentOrg() org: CurrentOrgPayload,
  ): Promise<PartnerRelationship[]> {
    return this.partnerService.getMyPartners(org.id);
  }

  @Post('accept-invite')
  @ApiOperation({ summary: 'Partner davetini kabul et' })
  @ApiResponse({ status: 200 })
  async acceptInvite(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AcceptInviteDto,
  ): Promise<PartnerRelationship> {
    if (user.isImpersonating) {
      throw new ForbiddenException(
        'Davet kabulü yalnızca kendi oturumunuzdan yapılabilir.',
      );
    }
    return this.partnerService.acceptInvite(user.organizationId, dto);
  }

  @Delete('my-partners/:id')
  @ApiOperation({ summary: 'Partner ilişkisini sonlandır (müşteri)' })
  @ApiResponse({ status: 200 })
  async terminatePartner(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
  ): Promise<{ success: true }> {
    await this.partnerService.terminateRelationship(org.id, id);
    return { success: true };
  }

  @Get('available-partners')
  @ApiOperation({ summary: 'Keşfedilebilir partner listesi (müşteri)' })
  @ApiResponse({ status: 200 })
  async getAvailablePartners(
    @CurrentOrg() org: CurrentOrgPayload,
  ): Promise<Awaited<ReturnType<PartnerLinkService['getAvailablePartners']>>> {
    return this.partnerLinkService.getAvailablePartners(org.id);
  }

  @Post('link-request')
  @ApiOperation({ summary: 'Partner bağlantı talebi gönder (müşteri)' })
  @ApiResponse({ status: 201 })
  async requestPartnerLink(
    @CurrentOrg() org: CurrentOrgPayload,
    @Body() dto: PartnerLinkRequestDto,
  ): Promise<{ success: true }> {
    await this.partnerLinkService.requestPartnerLink(
      org.id,
      dto.partnerOrgId,
      dto.message,
    );
    return { success: true };
  }
}
