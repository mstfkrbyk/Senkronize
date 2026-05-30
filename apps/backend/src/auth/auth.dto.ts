import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AccountingMode, OrgType, PlanTier } from '@prisma/client';
import type { ProductSelection } from '../common/product-lines';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({
    description: 'Hesap sahibinin adı ve soyadı',
    example: 'Ayşe Yılmaz',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({
    description: 'Giriş ve bildirimler için kullanılacak e-posta',
    example: 'ayse@firma.com',
    required: true,
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'En az 8 karakter; harf ve rakam içermesi önerilir',
    example: 'GuvenliSifre123',
    required: true,
  })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({
    description: 'İletişim için cep telefonu (ülke kodu ile)',
    example: '+905551112233',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  phone: string;

  @ApiProperty({
    description: 'Ticari unvan veya şirket adı',
    example: 'Örnek Lojistik A.Ş.',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  companyName: string;

  @ApiProperty({
    description: 'On haneli vergi kimlik numarası (VKN)',
    example: '1234567890',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{10}$/, { message: 'Vergi numarası 10 haneli olmalıdır' })
  taxNumber: string;

  @ApiProperty({
    description: 'Bağlı olunan vergi dairesi adı',
    example: 'Kadıköy',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  taxOffice: string;

  @ApiProperty({
    description: 'Şirket açık adresi',
    example: 'Bağdat Cad. No:1 Kadıköy / İstanbul',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  address: string;

  @ApiProperty({
    description: 'İl veya ilçe merkezi şehir adı',
    example: 'İstanbul',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  city: string;

  @ApiPropertyOptional({
    description: 'Kurumsal web sitesi (varsa)',
    example: 'https://www.ornek.com',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;

  @ApiPropertyOptional({
    description: 'Referans kampanyası veya ortak kodu',
    example: 'PARTNER2024',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  referralCode?: string;

  @ApiPropertyOptional({
    description: 'Davet bağlantısından gelen tek kullanımlık davet anahtarı',
    example: 'inv_01HZX9K2M4N5P6Q7R8S9T0V1W',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MinLength(10)
  inviteToken?: string;

  @ApiPropertyOptional({
    description: 'Organizasyon tipi: doğrudan müşteri veya partner',
    enum: OrgType,
    enumName: 'OrgType',
    example: OrgType.DIRECT,
    required: false,
  })
  @IsOptional()
  @IsEnum(OrgType)
  orgType?: OrgType;

  @ApiPropertyOptional({
    description: 'Kayıt sırasında seçilen abonelik paketi',
    enum: PlanTier,
    enumName: 'PlanTier',
    example: PlanTier.BASLANGIC,
    required: false,
  })
  @IsOptional()
  @IsEnum(PlanTier)
  plan?: PlanTier;

  @ApiPropertyOptional({
    description: 'Kayıt sırasında seçilen ürün hattı',
    enum: ['ACCOUNTING', 'INTEGRATION', 'BUNDLE'],
    example: 'BUNDLE',
    required: false,
  })
  @IsOptional()
  @IsIn(['ACCOUNTING', 'INTEGRATION', 'BUNDLE'])
  productSelection?: ProductSelection;

  @ApiPropertyOptional({
    description:
      'BUNDLE veya ACCOUNTING kayıtta muhasebe yönetim yeri: NATIVE veya EXTERNAL_ERP (ACCOUNTING seçimsiz → NATIVE)',
    enum: AccountingMode,
    enumName: 'AccountingMode',
    example: AccountingMode.NATIVE,
    required: false,
  })
  @IsOptional()
  @IsEnum(AccountingMode, {
    message: 'accountingMode NATIVE veya EXTERNAL_ERP olmalıdır.',
  })
  accountingMode?: AccountingMode;
}

export class RecommendPlanDto {
  @ApiProperty({
    description: 'Bağlanması planlanan ERP sayısı (0–100)',
    example: 1,
    minimum: 0,
    maximum: 100,
    required: true,
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  erpCount: number;

  @ApiProperty({
    description: 'Bağlanması planlanan pazaryeri sayısı (0–100)',
    example: 3,
    minimum: 0,
    maximum: 100,
    required: true,
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  marketplaceCount: number;

  @ApiProperty({
    description: 'Bağlanması planlanan e-ticaret kanalı sayısı (0–100)',
    example: 1,
    minimum: 0,
    maximum: 100,
    required: true,
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  ecommerceCount: number;
}

export class LoginDto {
  @ApiProperty({
    description: 'Kayıtlı kullanıcı e-postası',
    example: 'ayse@firma.com',
    required: true,
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Hesap parolası',
    example: 'GuvenliSifre123',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  password: string;
}

export class AcceptInviteDto {
  @ApiProperty({
    description: 'Daveti kabul eden kullanıcının görünen adı',
    example: 'Mehmet Kaya',
    required: true,
  })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty({
    description: 'Yeni hesap parolası (en az 8 karakter)',
    example: 'YeniGuvenliSifre456',
    required: true,
  })
  @IsString()
  @MinLength(8)
  password: string;
}

export class RefreshTokenDto {
  @ApiProperty({
    description: 'Önceki oturumdan dönen yenileme jetonu',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

export class ForgotPasswordDto {
  @ApiProperty({
    description: 'Şifre sıfırlama bağlantısı gönderilecek e-posta',
    example: 'kullanici@firma.com',
    required: true,
  })
  @IsEmail()
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty({
    description: 'E-posta ile gönderilen şifre sıfırlama tokeni',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({
    description: 'Belirlenecek yeni şifre',
    example: 'YeniSifre456!',
    required: true,
  })
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  newPassword: string;
}

export class ChangePasswordDto {
  @ApiProperty({
    description: 'Mevcut parola',
    example: 'EskiSifre123',
    required: true,
  })
  @IsString()
  @MinLength(1)
  currentPassword: string;

  @ApiProperty({
    description: 'Belirlenecek yeni parola',
    example: 'YeniSifre456',
    required: true,
  })
  @IsString()
  @MinLength(8)
  newPassword: string;
}

export class UpdateProfileDto {
  @ApiPropertyOptional({
    description: 'Profilde görünecek yeni ad',
    example: 'Ayşe Yılmaz Demir',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;
}
