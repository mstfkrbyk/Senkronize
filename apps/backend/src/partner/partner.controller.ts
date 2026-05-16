import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
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

import {
  AcceptInviteDto,
  InviteClientDto,
  UpdateRelationshipDto,
} from './partner.dto';
import { PartnerService } from './partner.service';

@ApiTags('Partner')
@ApiBearerAuth()
@Controller('partner')
@UseGuards(JwtAuthGuard)
export class PartnerController {
  constructor(private readonly partnerService: PartnerService) {}

  @Get('clients')
  @ApiOperation({ summary: 'Partner müşteri listesi' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 403 })
  async getClients(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PartnerRelationship[]> {
    return this.partnerService.getMyClients(user.organizationId);
  }

  @Post('clients/invite')
  @ApiOperation({ summary: 'Müşteri davet et' })
  @ApiResponse({ status: 201 })
  async inviteClient(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: InviteClientDto,
  ): Promise<{ inviteUrl: string }> {
    return this.partnerService.inviteClient(user.organizationId, dto);
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
}
