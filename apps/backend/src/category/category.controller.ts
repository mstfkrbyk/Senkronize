import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Marketplace } from '@prisma/client';

import { CurrentOrg, CurrentOrgPayload } from '../auth/current-org.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import {
  CreateCategoryDto,
  PlatformCategoryMappingDto,
  UpdateCategoryDto,
} from './category.dto';
import { CategoryService } from './category.service';

@ApiTags('categories')
@ApiBearerAuth()
@Controller('categories')
@UseGuards(JwtAuthGuard)
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get('tree')
  @ApiOperation({ summary: 'Hiyerarşik kategori ağacı' })
  @ApiResponse({ status: 200, description: 'Ağaç' })
  async tree(@CurrentOrg() org: CurrentOrgPayload) {
    return this.categoryService.getCategoryTree(org.id);
  }

  @Get()
  @ApiOperation({ summary: 'Kategori listesi (düz)' })
  @ApiResponse({ status: 200, description: 'Liste' })
  async list(@CurrentOrg() org: CurrentOrgPayload) {
    return this.categoryService.listCategories(org.id);
  }

  @Get('platform-mappings')
  @ApiOperation({ summary: 'Platform kategori haritası' })
  @ApiResponse({ status: 200, description: 'Eşlemeler' })
  async platformMappings(
    @CurrentOrg() org: CurrentOrgPayload,
    @Query('platform', new ParseEnumPipe(Marketplace)) platform: Marketplace,
  ) {
    return this.categoryService.getPlatformMappings(org.id, platform);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Kategori detayı (ürünler + platform eşlemeleri)' })
  @ApiResponse({ status: 200, description: 'Detay' })
  @ApiResponse({ status: 404, description: 'Bulunamadı' })
  async detail(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
  ) {
    return this.categoryService.getCategoryDetail(org.id, id);
  }

  @Post()
  @ApiOperation({ summary: 'Kategori oluştur' })
  @ApiResponse({ status: 201, description: 'Oluşturuldu' })
  async create(
    @CurrentOrg() org: CurrentOrgPayload,
    @Body() dto: CreateCategoryDto,
  ) {
    return this.categoryService.createCategory(org.id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Kategori güncelle' })
  @ApiResponse({ status: 200, description: 'Güncellendi' })
  async update(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categoryService.updateCategory(org.id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Kategoriyi sil (soft, alt ağaç dahil)' })
  @ApiResponse({ status: 200, description: 'Silindi' })
  async remove(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
  ): Promise<{ ok: true }> {
    await this.categoryService.deleteCategory(org.id, id);
    return { ok: true };
  }

  @Post(':id/platform-mapping')
  @ApiOperation({ summary: 'Platform kategori eşlemesi kaydet' })
  @ApiResponse({ status: 201, description: 'Kaydedildi' })
  async platformMapping(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
    @Body() dto: PlatformCategoryMappingDto,
  ): Promise<{ ok: true }> {
    await this.categoryService.mapToPlatformCategory(
      org.id,
      id,
      dto.platform,
      dto.platformCategoryId,
      dto.platformCategoryName,
    );
    return { ok: true };
  }
}
