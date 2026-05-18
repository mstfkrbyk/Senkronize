import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentOrg, CurrentOrgPayload } from '../auth/current-org.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { AuditLogQueryDto } from './audit-log-query.dto';
import { UsersService, type AuditLogListItem } from './users.service';

@ApiTags('Audit Log')
@ApiBearerAuth()
@Controller('audit-log')
export class AuditLogController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Organizasyon denetim kayıtları (son N)' })
  @ApiResponse({ status: 200, description: 'Denetim kayıtları' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  async list(
    @CurrentOrg() org: CurrentOrgPayload,
    @Query() query: AuditLogQueryDto,
  ): Promise<AuditLogListItem[]> {
    const limit = query.limit ?? 50;
    return this.usersService.getAuditLog(org.id, limit, query.action);
  }
}
