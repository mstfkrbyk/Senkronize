import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import {
  CurrentOrg,
  CurrentOrgPayload,
} from '../auth/current-org.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/guards/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import {
  OrganizationSettingsResponseDto,
  PatchOrganizationSettingsDto,
} from './organization-settings.dto';
import { UpdateOrganizationDto } from './organization.dto';
import { OrganizationService } from './organization.service';

@ApiTags('organizations')
@ApiBearerAuth()
@Controller('organizations')
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Mevcut organizasyon profili' })
  @ApiResponse({ status: 200, description: 'Organizasyon bilgisi' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  async me(@CurrentOrg() org: CurrentOrgPayload) {
    return this.organizationService.getById(org.id);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Organizasyon adı veya logosunu güncelle' })
  @ApiResponse({ status: 200, description: 'Güncellendi' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  @ApiResponse({ status: 403, description: 'Yetki yetersiz' })
  async updateMe(
    @CurrentOrg() org: CurrentOrgPayload,
    @Body() dto: UpdateOrganizationDto,
  ) {
    return this.organizationService.update(org.id, dto);
  }

  @Get('settings')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Organizasyon ayarları',
    description:
      'Fatura numaralandırma (önek, sıra) ve NATIVE modda siparişten otomatik fatura varsayılanı (`defaultAutoInvoice`).',
  })
  @ApiResponse({ status: 200, type: OrganizationSettingsResponseDto })
  async getSettings(
    @CurrentOrg() org: CurrentOrgPayload,
  ): Promise<OrganizationSettingsResponseDto> {
    return this.organizationService.getSettings(org.id);
  }

  @Patch('settings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Organizasyon ayarlarını güncelle',
    description:
      'Kısmi güncelleme: `invoiceNumberPrefix`, `nextSequence`, `defaultAutoInvoice` (NATIVE otomatik fatura).',
  })
  @ApiResponse({ status: 200, type: OrganizationSettingsResponseDto })
  async patchSettings(
    @CurrentOrg() org: CurrentOrgPayload,
    @Body() dto: PatchOrganizationSettingsDto,
  ): Promise<OrganizationSettingsResponseDto> {
    return this.organizationService.updateSettings(org.id, dto);
  }
}
