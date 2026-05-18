import {
  BadRequestException,
  Controller,
  Get,
  Header,
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
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { AuditLogsQueryDto } from './audit-logs-query.dto';
import { UsersService, type AuditLogsPageResult } from './users.service';

@ApiTags('Audit Log')
@ApiBearerAuth()
@Controller('audit-logs')
export class AuditLogsController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Organizasyon denetim kayıtları (sayfalı)' })
  @ApiResponse({ status: 200, description: 'Denetim kayıtları ve toplam' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  async list(
    @CurrentOrg() org: CurrentOrgPayload,
    @Query() query: AuditLogsQueryDto,
  ): Promise<AuditLogsPageResult> {
    return this.usersService.getAuditLogsPage(org.id, query);
  }

  @Get('export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="audit-logs.csv"')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Denetim kayıtları CSV dışa aktarım' })
  @ApiResponse({ status: 200, description: 'CSV' })
  @ApiResponse({ status: 400, description: 'Desteklenmeyen format' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  async exportCsv(
    @CurrentOrg() org: CurrentOrgPayload,
    @Query() query: AuditLogsQueryDto,
  ): Promise<string> {
    if (query.format !== 'csv') {
      throw new BadRequestException('Yalnızca format=csv desteklenir');
    }
    return this.usersService.exportAuditLogsCsv(org.id, query);
  }
}
