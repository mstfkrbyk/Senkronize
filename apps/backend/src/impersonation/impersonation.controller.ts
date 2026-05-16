import { Body, Controller, ForbiddenException, Get, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { StartImpersonationDto, StopImpersonationDto } from './impersonation.dto';
import { ImpersonationService } from './impersonation.service';

@ApiTags('Impersonation')
@ApiBearerAuth()
@Controller('impersonation')
@UseGuards(JwtAuthGuard)
export class ImpersonationController {
  constructor(private readonly impersonationService: ImpersonationService) {}

  @Post('start')
  @ApiOperation({ summary: 'Müşteri adına geçici token al' })
  @ApiResponse({ status: 200 })
  async start(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: StartImpersonationDto,
  ): Promise<{ impersonationToken: string; expiresIn: number }> {
    if (user.isImpersonating) {
      throw new ForbiddenException(
        'Zaten müşteri adına oturum açık; önce normal oturuma dönün.',
      );
    }
    return this.impersonationService.startImpersonation(
      user.id,
      user.organizationId,
      user.role,
      dto.clientOrgId,
    );
  }

  @Post('stop')
  @ApiOperation({ summary: 'Müşteri adına oturumu bitir (denetim kaydı)' })
  @ApiResponse({ status: 200 })
  async stop(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: StopImpersonationDto,
  ): Promise<{ success: true }> {
    await this.impersonationService.stopImpersonation(
      user.id,
      user.organizationId,
      dto.clientOrgId,
    );
    return { success: true };
  }

  @Get('active')
  @ApiOperation({ summary: 'Mevcut JWT ile impersonation durumu' })
  @ApiResponse({ status: 200 })
  async active(@CurrentUser() user: AuthenticatedUser): Promise<{
    isImpersonating: boolean;
    impersonatedOrgId: string | null;
    partnerOrgId: string | null;
  }> {
    return {
      isImpersonating: user.isImpersonating,
      impersonatedOrgId: user.isImpersonating ? user.currentOrgId : null,
      partnerOrgId: user.isImpersonating ? user.organizationId : null,
    };
  }
}
