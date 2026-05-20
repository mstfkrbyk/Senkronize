import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SuperAdminGuard } from '../admin/admin.guard';

import { CreateHelpArticleDto } from './help.dto';
import { HelpService } from './help.service';
import type { HelpArticleDetailDto } from './help.types';

@ApiTags('admin-help')
@ApiBearerAuth()
@Controller('admin/help/articles')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class HelpAdminController {
  constructor(private readonly helpService: HelpService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Yardım makalesi oluştur' })
  @ApiResponse({ status: 201, description: 'Oluşturuldu' })
  async create(
    @Body() dto: CreateHelpArticleDto,
  ): Promise<{ data: HelpArticleDetailDto }> {
    const data = await this.helpService.create(dto);
    return { data };
  }
}
