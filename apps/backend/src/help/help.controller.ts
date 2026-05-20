import { Controller, Get, Param, Patch, Query } from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { Public } from '../auth/public.decorator';

import { HelpArticleQueryDto } from './help.dto';
import { HelpService } from './help.service';
import type {
  HelpArticleDetailDto,
  HelpArticleListItemDto,
} from './help.types';

@ApiTags('help')
@Controller('help/articles')
export class HelpController {
  constructor(private readonly helpService: HelpService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Yayımlanan yardım makaleleri' })
  @ApiResponse({ status: 200, description: 'Liste' })
  async list(
    @Query() query: HelpArticleQueryDto,
  ): Promise<{ data: HelpArticleListItemDto[] }> {
    return this.helpService.listPublished(query);
  }

  @Public()
  @Get(':slug')
  @ApiOperation({ summary: 'Yardım makalesi detayı' })
  @ApiResponse({ status: 200, description: 'Detay' })
  @ApiResponse({ status: 404, description: 'Bulunamadı' })
  async detail(
    @Param('slug') slug: string,
  ): Promise<{ data: HelpArticleDetailDto }> {
    const data = await this.helpService.getBySlug(slug);
    return { data };
  }

  @Public()
  @Patch(':slug/helpful')
  @ApiOperation({ summary: 'Makaleyi yararlı olarak işaretle' })
  @ApiResponse({ status: 200, description: 'Güncellendi' })
  async markHelpful(
    @Param('slug') slug: string,
  ): Promise<{ data: { helpful: number } }> {
    const data = await this.helpService.markHelpful(slug);
    return { data };
  }
}
