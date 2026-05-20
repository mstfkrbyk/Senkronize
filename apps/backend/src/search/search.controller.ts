import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentOrg, CurrentOrgPayload } from '../auth/current-org.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { GlobalSearchQueryDto } from './search.dto';
import { SearchService } from './search.service';
import type { SearchResults } from './search.types';

@ApiTags('Arama')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({ summary: 'Global arama (ürün, sipariş, listeleme)' })
  @ApiResponse({ status: 200, description: 'Arama sonuçları' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  async globalSearch(
    @CurrentOrg() org: CurrentOrgPayload,
    @Query() query: GlobalSearchQueryDto,
  ): Promise<{ data: SearchResults }> {
    const q = query.q?.trim() ?? '';
    const limit = query.limit ?? 10;
    const data = await this.searchService.globalSearch(org.id, q, limit);
    return { data };
  }
}
