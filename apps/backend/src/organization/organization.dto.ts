import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

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
}
