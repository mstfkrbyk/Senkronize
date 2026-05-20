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
  UpdateTicketStatusDto,
} from './support.dto';
import { SupportService } from './support.service';
import type {
  AdminSupportTicketListItemDto,
  SupportTicketDetailDto,
} from './support.types';

@ApiTags('admin-support')
@ApiBearerAuth()
@Controller('admin/tickets')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class SupportAdminController {
  constructor(private readonly supportService: SupportService) {}

  @Get()
  @ApiOperation({ summary: 'Tüm destek talepleri (admin)' })
  @ApiResponse({ status: 200, description: 'Liste' })
  async list(
    @Query() query: AdminTicketQueryDto,
  ): Promise<{ data: AdminSupportTicketListItemDto[] }> {
    return this.supportService.getAdminTickets(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Destek talebi detayı (admin)' })
  @ApiResponse({ status: 200, description: 'Detay' })
  async detail(
    @Param('id') id: string,
  ): Promise<{ data: SupportTicketDetailDto }> {
    const data = await this.supportService.getTicketForAdmin(id);
    return { data };
  }

  @Patch(':id/assign')
  @ApiOperation({ summary: 'Talebi admin kullanıcıya ata' })
  @ApiResponse({ status: 200, description: 'Atandı' })
  async assign(
    @Param('id') id: string,
    @Body() dto: AssignTicketDto,
  ): Promise<{ data: SupportTicketDetailDto }> {
    const data = await this.supportService.assignTicket(id, dto.adminId);
    return { data };
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Talep durumunu güncelle' })
  @ApiResponse({ status: 200, description: 'Güncellendi' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateTicketStatusDto,
  ): Promise<{ data: SupportTicketDetailDto }> {
    const data = await this.supportService.updateStatus(id, dto.status);
    return { data };
  }

  @Post(':id/messages')
  @ApiOperation({ summary: 'Talebe mesaj veya iç not ekle' })
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
