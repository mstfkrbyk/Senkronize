import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const BACKUP_CODE_PATTERN = /^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{8}$/;

export class TwoFactorEnableDto {
  @ApiProperty({ description: 'Authenticator uygulamasından 6 haneli kod' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{6}$/, { message: 'Doğrulama kodu 6 haneli olmalıdır' })
  token: string;

  @ApiProperty({
    description: 'Kurulumda gösterilen 10 yedek kod (aynı sıra ile)',
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(10)
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @Matches(BACKUP_CODE_PATTERN, { each: true, message: 'Yedek kod biçimi geçersiz' })
  backupCodes: string[];
}

export class TwoFactorDisableDto {
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
