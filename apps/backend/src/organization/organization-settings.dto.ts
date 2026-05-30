import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import type { InvoiceNumberingSettings, ProductMatchKey } from './organization.types';

export class OrganizationSettingsResponseDto implements InvoiceNumberingSettings {
  @ApiProperty({ example: 'FTR', description: 'Fatura numarası öneki (boş = yıl/sıra formatı)' })
  invoiceNumberPrefix!: string;

  @ApiProperty({ example: 42, description: 'Bir sonraki faturada kullanılacak sıra numarası' })
  nextSequence!: number;

  @ApiProperty({
    example: true,
    default: true,
    description:
      'Yerel ön muhasebe (NATIVE): yeni siparişlerde kargoya verildi veya teslim edildiğinde taslak satış faturası oluşturulur. ' +
      'Metadata\'da kayıt yoksa veya açıkça false değilse true döner. Harici ERP modunda bağlantı başına yapılandırılır; ' +
      'platform webhook durum güncellemeleri bu ayarı tetiklemez.',
  })
  defaultAutoInvoice!: boolean;

  @ApiProperty({
    enum: ['BARCODE', 'SKU', 'MANUAL'],
    example: 'BARCODE',
    nullable: true,
    description:
      'Organizasyon varsayılan eşleştirme yöntemi. Kurulumda seçilmediyse null döner.',
  })
  productMatchKey!: ProductMatchKey | null;
}

export class PatchOrganizationSettingsDto {
  @ApiPropertyOptional({
    example: 'FTR',
    description: 'Önek; boş bırakılırsa YYYY/000001 formatı kullanılır',
  })
  @IsOptional()
  @IsString()
  @MaxLength(10, { message: 'Önek en fazla 10 karakter olabilir.' })
  @Matches(/^[A-Za-z0-9]*$/, {
    message: 'Önek yalnızca harf ve rakam içerebilir.',
  })
  invoiceNumberPrefix?: string;

  @ApiPropertyOptional({ example: 1, description: 'Sonraki sıra numarası (minimum 1)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Sıra numarası tam sayı olmalıdır.' })
  @Min(1, { message: 'Sıra numarası en az 1 olmalıdır.' })
  @Max(9_999_999, { message: 'Sıra numarası en fazla 9.999.999 olabilir.' })
  nextSequence?: number;

  @ApiPropertyOptional({
    example: true,
    description:
      'NATIVE modda organizasyon varsayılanı: kargoya verildi veya teslim edildiğinde otomatik taslak satış faturası (false ile kapatılır)',
  })
  @IsOptional()
  @IsBoolean({ message: 'Otomatik fatura ayarı true veya false olmalıdır.' })
  defaultAutoInvoice?: boolean;

  @ApiPropertyOptional({
    enum: ['BARCODE', 'SKU', 'MANUAL'],
    description: 'ERP ve pazaryeri ürün eşleştirme anahtarı',
  })
  @IsOptional()
  @IsEnum(['BARCODE', 'SKU', 'MANUAL'], {
    message: 'productMatchKey BARCODE, SKU veya MANUAL olmalıdır.',
  })
  productMatchKey?: ProductMatchKey;
}
