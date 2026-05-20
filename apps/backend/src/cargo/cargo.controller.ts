import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
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
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import {
  CargoShipmentQueryDto,
  CompareCargoRatesDto,
  CreateCargoShipmentDto,
  OptimalCarrierQueryDto,
} from './cargo.dto';
import { CargoOptimizerService } from './cargo-optimizer.service';
import { CargoRateService } from './cargo-rate.service';
import { CargoService } from './cargo.service';

@ApiTags('cargo')
@ApiBearerAuth()
@Controller('cargo')
export class CargoController {
  constructor(
    private readonly cargoService: CargoService,
    private readonly cargoRateService: CargoRateService,
    private readonly cargoOptimizerService: CargoOptimizerService,
  ) {}

  @Get('optimal-carrier')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Sipariş için en uygun kargo firması önerisi' })
  @ApiResponse({ status: 200, description: 'Kargo önerisi' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  @ApiResponse({ status: 404, description: 'Sipariş veya bağlantı bulunamadı' })
  async getOptimalCarrier(
    @CurrentOrg() org: CurrentOrgPayload,
    @Query() query: OptimalCarrierQueryDto,
  ) {
    return this.cargoOptimizerService.getOptimalCarrierForOrder(org.id, query.orderId);
  }

  @Post('rates/compare')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Aktif kargo bağlantılarından fiyat karşılaştır' })
  @ApiResponse({ status: 200, description: 'Fiyat karşılaştırması' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  @ApiResponse({ status: 404, description: 'Sipariş bulunamadı' })
  async compareRates(
    @CurrentOrg() org: CurrentOrgPayload,
    @Body() dto: CompareCargoRatesDto,
  ) {
    return this.cargoRateService.compareRates(org.id, dto.orderId, dto.weightKg);
  }

  @Post('shipments')
  @HttpCode(201)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Kargo gönderisi oluştur ve siparişe takip numarası yaz' })
  @ApiResponse({ status: 201, description: 'Gönderi oluşturuldu' })
  @ApiResponse({ status: 400, description: 'Geçersiz istek' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  @ApiResponse({ status: 404, description: 'Sipariş bulunamadı' })
  async createShipment(
    @CurrentOrg() org: CurrentOrgPayload,
    @Body() dto: CreateCargoShipmentDto,
  ) {
    return this.cargoService.createShipment(
      org.id,
      dto.orderId,
      dto.cargoProvider,
    );
  }

  @Get('shipments/:trackingCode')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Kargo takip sorgusu' })
  @ApiResponse({ status: 200, description: 'Takip bilgisi' })
  @ApiResponse({ status: 400, description: 'Geçersiz istek' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  async trackShipment(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('trackingCode') trackingCode: string,
    @Query() query: CargoShipmentQueryDto,
  ) {
    return this.cargoService.trackShipment(
      org.id,
      trackingCode,
      query.cargoProvider,
    );
  }

  @Delete('shipments/:trackingCode')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Kargo gönderisini iptal et' })
  @ApiResponse({ status: 200, description: 'İptal edildi' })
  @ApiResponse({ status: 400, description: 'Geçersiz istek' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  async cancelShipment(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('trackingCode') trackingCode: string,
    @Query() query: CargoShipmentQueryDto,
  ): Promise<{ ok: true }> {
    await this.cargoService.cancelShipment(
      org.id,
      trackingCode,
      query.cargoProvider,
    );
    return { ok: true };
  }
}
