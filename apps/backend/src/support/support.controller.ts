import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
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

import { CurrentOrg, CurrentOrgPayload } from '../auth/current-org.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import {
  AddTicketMessageDto,
  CreateSupportTicketDto,
  SupportTicketQueryDto,
} from './support.dto';
import { SupportService } from './support.service';
import type {
  SupportTicketDetailDto,
  SupportTicketListItemDto,
} from './support.types';

@ApiTags('support')
@ApiBearerAuth()
@Controller('support/tickets')
@UseGuards(JwtAuthGuard)
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Yeni destek talebi oluştur' })
  @ApiResponse({ status: 201, description: 'Oluşturuldu' })
  async create(
    @CurrentOrg() org: CurrentOrgPayload,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSupportTicketDto,
  ): Promise<{ data: SupportTicketDetailDto }> {
    const data = await this.supportService.createTicket(org.id, user.id, dto);
    return { data };
  }

  @Get()
  @ApiOperation({ summary: 'Kullanıcının destek talepleri' })
  @ApiResponse({ status: 200, description: 'Liste' })
  async list(
    @CurrentOrg() org: CurrentOrgPayload,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: SupportTicketQueryDto,
  ): Promise<{ data: SupportTicketListItemDto[] }> {
    return this.supportService.getTickets(org.id, user.id, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Destek talebi detayı' })
  @ApiResponse({ status: 200, description: 'Detay' })
  @ApiResponse({ status: 404, description: 'Bulunamadı' })
  async detail(
    @CurrentOrg() org: CurrentOrgPayload,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<{ data: SupportTicketDetailDto }> {
    const data = await this.supportService.getTicket(org.id, user.id, id);
    return { data };
  }

  @Post(':id/messages')
  @ApiOperation({ summary: 'Talebe mesaj ekle' })
  @ApiResponse({ status: 200, description: 'Güncellendi' })
  async addMessage(
    @CurrentOrg() org: CurrentOrgPayload,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AddTicketMessageDto,
  ): Promise<{ data: SupportTicketDetailDto }> {
    const data = await this.supportService.addMessage(
      org.id,
      id,
      user.id,
      dto.content,
    );
    return { data };
  }

  @Patch(':id/close')
  @ApiOperation({ summary: 'Talebi kapat' })
  @ApiResponse({ status: 200, description: 'Kapatıldı' })
  async close(
    @CurrentOrg() org: CurrentOrgPayload,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<{ data: SupportTicketDetailDto }> {
    const data = await this.supportService.closeTicket(org.id, user.id, id);
    return { data };
  }
}
