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

import { CargoShipmentQueryDto, CreateCargoShipmentDto } from './cargo.dto';
import { CargoService } from './cargo.service';

@ApiTags('cargo')
@ApiBearerAuth()
@Controller('cargo')
export class CargoController {
  constructor(private readonly cargoService: CargoService) {}

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
