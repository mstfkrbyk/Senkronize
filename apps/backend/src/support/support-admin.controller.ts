import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SuperAdminGuard } from '../admin/admin.guard';

import {
  AdminAddTicketMessageDto,
  AdminTicketQueryDto,
  AssignTicketDto,
  InternalNoteDto,
  UpdateAdminTicketDto,
} from './support.dto';
import { SupportService } from './support.service';
import type {
  AdminSupportTicketListItemDto,
  SupportSlaReportDto,
  SupportStatsDto,
  SupportTicketDetailDto,
} from './support.types';

@ApiTags('admin-support')
@ApiBearerAuth()
@Controller('admin/support')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class SupportAdminController {
  constructor(private readonly supportService: SupportService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Destek talebi durum sayıları (KPI)' })
  @ApiResponse({ status: 200, description: 'Açık / işlemde / bekleyen sayıları' })
  async stats(): Promise<{ data: SupportStatsDto }> {
    return this.supportService.getSupportStats();
  }

  @Get('sla')
  @ApiOperation({ summary: 'SLA raporu' })
  @ApiResponse({ status: 200, description: 'SLA metrikleri' })
  async sla(): Promise<{ data: SupportSlaReportDto }> {
    return this.supportService.getSlaReport();
  }

  @Get('tickets')
  @ApiOperation({ summary: 'Tüm destek talepleri (admin)' })
  @ApiResponse({ status: 200, description: 'Liste' })
  async list(
    @Query() query: AdminTicketQueryDto,
  ): Promise<{ data: AdminSupportTicketListItemDto[] }> {
    return this.supportService.getAdminTickets(query);
  }

  @Get('tickets/:id')
  @ApiOperation({ summary: 'Destek talebi detayı (admin)' })
  @ApiResponse({ status: 200, description: 'Detay' })
  async detail(
    @Param('id') id: string,
  ): Promise<{ data: SupportTicketDetailDto }> {
    const data = await this.supportService.getTicketForAdmin(id);
    return { data };
  }

  @Patch('tickets/:id')
  @ApiOperation({ summary: 'Talep durum/öncelik/atama güncelle' })
  @ApiResponse({ status: 200, description: 'Güncellendi' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateAdminTicketDto,
  ): Promise<{ data: SupportTicketDetailDto }> {
    const data = await this.supportService.updateTicketAdmin(id, dto);
    return { data };
  }

  @Post('tickets/:id/assign')
  @ApiOperation({ summary: 'Talebi destek uzmanına ata' })
  @ApiResponse({ status: 200, description: 'Atandı' })
  async assign(
    @Param('id') id: string,
    @Body() dto: AssignTicketDto,
  ): Promise<{ data: SupportTicketDetailDto }> {
    const data = await this.supportService.assignTicket(id, dto.adminId);
    return { data };
  }

  @Post('tickets/:id/internal-note')
  @ApiOperation({ summary: 'İç not ekle' })
  @ApiResponse({ status: 200, description: 'Eklendi' })
  async addInternalNote(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: InternalNoteDto,
  ): Promise<{ data: SupportTicketDetailDto }> {
    const data = await this.supportService.addInternalNote(
      id,
      user.id,
      dto.content,
    );
    return { data };
  }

  @Post('tickets/:id/messages')
  @ApiOperation({ summary: 'Talebe mesaj ekle (admin)' })
  @ApiResponse({ status: 200, description: 'Eklendi' })
  async addMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AdminAddTicketMessageDto,
  ): Promise<{ data: SupportTicketDetailDto }> {
    const data = await this.supportService.addAdminMessage(
      id,
      user.id,
      dto.content,
      dto.isInternal === true,
    );
    return { data };
  }
}
