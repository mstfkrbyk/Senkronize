import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { SUPPORTED_CURRENCIES } from '../currency/currency.constants';

const ORG_CURRENCIES = [...SUPPORTED_CURRENCIES] as string[];

export class UpdateOrganizationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  logoUrl?: string;

  @ApiPropertyOptional({ description: 'İlk kurulum sihirbazı tamamlandı mı?' })
  @IsOptional()
  @IsBoolean()
  onboardingCompleted?: boolean;

  @ApiPropertyOptional({ description: 'Varsayılan para birimi (ISO 4217)' })
  @IsOptional()
  @IsString()
  @IsIn(ORG_CURRENCIES)
  defaultCurrency?: string;

  @ApiPropertyOptional({
    description: 'Manuel kurlar tanımlıysa TCMB yerine öncelikli kullan',
  })
  @IsOptional()
  @IsBoolean()
  currencyPreferManualRates?: boolean;

  @ApiPropertyOptional({
    description: 'Raporlarda TCMB kurlarını kullan (kapalıysa yalnızca manuel)',
  })
  @IsOptional()
  @IsBoolean()
  currencyTcmbEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Manuel kur: 1 birim yabancı para = X TRY',
  })
  @IsOptional()
  @IsObject()
  currencyManualRates?: Record<string, number>;

  @ApiPropertyOptional({ description: 'Organizasyon genelinde 2FA zorunluluğu' })
  @IsOptional()
  @IsBoolean()
  require2FA?: boolean;

  @ApiPropertyOptional({ description: 'Minimum şifre uzunluğu' })
  @IsOptional()
  @IsInt()
  @Min(8)
  @Max(128)
  passwordMinLength?: number;

  @ApiPropertyOptional({ description: 'Özel karakter zorunluluğu' })
  @IsOptional()
  @IsBoolean()
  passwordRequireSpecial?: boolean;

  @ApiPropertyOptional({ description: 'Rakam zorunluluğu' })
  @IsOptional()
  @IsBoolean()
  passwordRequireNumber?: boolean;

  @ApiPropertyOptional({ description: 'Şifre maksimum yaşı (gün)' })
  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(365)
  passwordMaxAgeDays?: number;
}
