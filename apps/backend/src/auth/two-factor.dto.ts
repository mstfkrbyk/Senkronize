import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class TwoFactorVerifyDto {
  @ApiProperty({ description: 'Authenticator uygulamasından 6 haneli kod' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{6}$/, { message: 'Doğrulama kodu 6 haneli olmalıdır' })
  token: string;
}

/** @deprecated TwoFactorVerifyDto kullanın */
export class TwoFactorEnableDto extends TwoFactorVerifyDto {}

export class TwoFactorDisableDto {
  @ApiProperty({ description: 'Hesap şifresi' })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password: string;

  @ApiProperty({ description: '6 haneli TOTP veya yedek kod' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  @MinLength(6)
  token: string;
}

export class TwoFactorVerifyLoginDto {
  @ApiProperty({ description: 'İlk giriş adımında dönen geçici jeton' })
  @IsString()
  @IsNotEmpty()
  tempToken: string;

  @ApiProperty({ description: '6 haneli TOTP veya yedek kod' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  @MinLength(6)
  code: string;
}

export class TwoFactorRegenerateBackupDto {
  @ApiProperty({ description: '6 haneli TOTP veya geçerli yedek kod' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  @MinLength(6)
  token: string;
}

export class UpdateOrgSecurityPolicyDto {
  @ApiPropertyOptional()
  @IsOptional()
  require2FA?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @MinLength(8)
  @MaxLength(128)
  minLength?: number;

  @ApiPropertyOptional()
  @IsOptional()
  requireSpecial?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  requireNumber?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @MinLength(30)
  @MaxLength(365)
  maxAgeDays?: number;
}
