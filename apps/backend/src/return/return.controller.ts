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
import { Throttle } from '@nestjs/throttler';

import { CurrentOrg, CurrentOrgPayload } from '../auth/current-org.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import {
  RejectReturnDto,
  ReturnQueryDto,
  SyncReturnsDto,
} from './return.dto';
import {
  ReturnService,
  type ReturnDetailDto,
  type ReturnListItemDto,
} from './return.service';

@ApiTags('returns')
@ApiBearerAuth()
@Controller('returns')
export class ReturnController {
  constructor(private readonly returnService: ReturnService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'İade listesi' })
  @ApiResponse({ status: 200, description: 'Liste' })
  async list(
    @CurrentOrg() org: CurrentOrgPayload,
    @Query() query: ReturnQueryDto,
  ): Promise<{ items: ReturnListItemDto[]; total: number }> {
    return this.returnService.getReturns(org.id, query);
  }

  @Post('sync')
  @Throttle({ default: { limit: 10 } })
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Pazaryerinden iadeleri çek (kuyruk)' })
  @ApiResponse({ status: 201, description: 'İş oluşturuldu' })
  async sync(
    @CurrentOrg() org: CurrentOrgPayload,
    @Body() dto: SyncReturnsDto,
  ): Promise<{ jobId: string }> {
    return this.returnService.syncReturns(org.id, dto.connectionId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'İade detayı' })
  @ApiResponse({ status: 200, description: 'Detay' })
  @ApiResponse({ status: 404, description: 'Bulunamadı' })
  async detail(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
  ): Promise<ReturnDetailDto> {
    return this.returnService.getReturnDetail(org.id, id);
  }

  @Patch(':id/approve')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'İadeyi onayla' })
  @ApiResponse({ status: 200, description: 'Güncellendi' })
  async approve(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
  ): Promise<ReturnDetailDto> {
    return this.returnService.approveReturn(org.id, id);
  }

  @Patch(':id/reject')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'İadeyi reddet' })
  @ApiResponse({ status: 200, description: 'Güncellendi' })
  async reject(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
    @Body() dto: RejectReturnDto,
  ): Promise<ReturnDetailDto> {
    return this.returnService.rejectReturn(org.id, id, dto.reason);
  }
}
