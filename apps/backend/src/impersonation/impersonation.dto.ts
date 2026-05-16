import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class StartImpersonationDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  clientOrgId!: string;
}

export class StopImpersonationDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  clientOrgId!: string;
}
