import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { CurrentOrg, CurrentOrgPayload } from '../auth/current-org.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { ManualProductMatchDto } from './product-match.dto';
import { ProductMatchService } from './product-match.service';

@ApiTags('product-matches')
@ApiBearerAuth()
@Controller('product-matches')
@UseGuards(JwtAuthGuard)
export class ProductMatchController {
  constructor(private readonly productMatchService: ProductMatchService) {}

  @Post('auto')
  @ApiOperation({ summary: 'Barkod bazlı otomatik eşleştirme' })
  @ApiResponse({ status: 201, description: 'Özet' })
  async auto(@CurrentOrg() org: CurrentOrgPayload) {
    return this.productMatchService.autoMatchByBarcode(org.id);
  }

  @Get('unmatched')
  @ApiOperation({ summary: 'Eşleşmeyen listelemeler' })
  @ApiResponse({ status: 200, description: 'Liste' })
  async unmatched(@CurrentOrg() org: CurrentOrgPayload) {
    return this.productMatchService.listUnmatched(org.id);
  }

  @Get('conflicts')
  @ApiOperation({ summary: 'Ürün eşleştirme çakışmaları' })
  @ApiResponse({ status: 200, description: 'Çakışmalar' })
  async conflicts(@CurrentOrg() org: CurrentOrgPayload) {
    return this.productMatchService.findConflicts(org.id);
  }

  @Get('similar/:listingId')
  @ApiOperation({ summary: 'Listeleme için benzer katalog ürünleri' })
  @ApiResponse({ status: 200, description: 'Skorlu liste' })
  async similar(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('listingId') listingId: string,
  ) {
    return this.productMatchService.findSimilarProductsByListingId(org.id, listingId);
  }

  @Post('manual')
  @ApiOperation({ summary: 'Manuel eşleştirme (listeleme ↔ ürün)' })
  @ApiResponse({ status: 201, description: 'Tamamlandı' })
  async manual(
    @CurrentOrg() org: CurrentOrgPayload,
    @Body() dto: ManualProductMatchDto,
  ): Promise<{ ok: true }> {
    await this.productMatchService.manualLinkListing(org.id, dto);
    return { ok: true };
  }

  @Post(':id/confirm')
  @ApiOperation({ summary: 'Eşleşme kaydını onayla' })
  @ApiResponse({ status: 201, description: 'Onaylandı' })
  async confirm(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
  ): Promise<{ ok: true }> {
    await this.productMatchService.confirmMatch(org.id, id);
    return { ok: true };
  }
}
