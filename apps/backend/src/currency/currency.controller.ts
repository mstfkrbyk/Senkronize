import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Decimal } from '@prisma/client/runtime/library';

import {
  CurrentOrg,
  CurrentOrgPayload,
} from '../auth/current-org.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { ConvertCurrencyDto } from './currency.dto';
import { CurrencyService } from './currency.service';

@ApiTags('currency')
@ApiBearerAuth()
@Controller('currency')
@UseGuards(JwtAuthGuard)
export class CurrencyController {
  constructor(private readonly currencyService: CurrencyService) {}

  @Get('rates')
  @ApiOperation({ summary: 'Güncel TCMB tabanlı kurlar (1 birim = X TRY)' })
  @ApiResponse({ status: 200, description: 'Para birimi → kur' })
  async getRates(): Promise<Record<string, number>> {
    return this.currencyService.getLatestRates();
  }

  @Post('convert')
  @ApiOperation({ summary: 'Tutarı bir para biriminden diğerine çevir' })
  @ApiResponse({ status: 200, description: 'Dönüştürülmüş tutar' })
  async convert(
    @CurrentOrg() org: CurrentOrgPayload,
    @Body() dto: ConvertCurrencyDto,
  ): Promise<{ amount: number; from: string; to: string }> {
    const from = dto.from.trim().toUpperCase();
    const to = dto.to.trim().toUpperCase();
    const converted = await this.currencyService.convert(
      new Decimal(dto.amount),
      from,
      to,
      dto.date ? new Date(dto.date) : undefined,
      org.id,
    );
    return { amount: Number(converted), from, to };
  }
}
