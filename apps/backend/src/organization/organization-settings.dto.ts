import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

import type { InvoiceNumberingSettings } from './organization.types';

export class OrganizationSettingsResponseDto implements InvoiceNumberingSettings {
  @ApiProperty({ example: 'FTR', description: 'Fatura numarası öneki (boş = yıl/sıra formatı)' })
  invoiceNumberPrefix!: string;

  @ApiProperty({ example: 42, description: 'Bir sonraki faturada kullanılacak sıra numarası' })
  nextSequence!: number;
}

export class PatchOrganizationSettingsDto {
  @ApiPropertyOptional({
    example: 'FTR',
    description: 'Önek; boş bırakılırsa YYYY/000001 formatı kullanılır',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^[A-Za-z0-9][A-Za-z0-9_-]*$|^$/, {
    message: 'Önek yalnızca harf, rakam, tire ve alt çizgi içerebilir.',
  })
  invoiceNumberPrefix?: string;

  @ApiPropertyOptional({ example: 1, description: 'Sonraki sıra numarası (minimum 1)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(9_999_999)
  nextSequence?: number;
}
