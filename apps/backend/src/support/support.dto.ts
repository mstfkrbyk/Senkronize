import { TicketPriority, TicketStatus } from '@prisma/client';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateSupportTicketDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  subject!: string;

  @IsString()
  @IsNotEmpty()
  content!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  category?: string;

  @IsEnum(TicketPriority)
  priority!: TicketPriority;
}

export class SupportTicketQueryDto {
  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;

  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;
}

export class AddTicketMessageDto {
  @IsString()
  @IsNotEmpty()
  content!: string;
}

export class AdminTicketQueryDto extends SupportTicketQueryDto {
  @IsOptional()
  @IsString()
  organizationId?: string;
}

export class UpdateTicketStatusDto {
  @IsEnum(TicketStatus)
  status!: TicketStatus;
}

export class AssignTicketDto {
  @IsString()
  @IsNotEmpty()
  adminId!: string;
}

export class AdminAddTicketMessageDto extends AddTicketMessageDto {
  @IsOptional()
  isInternal?: boolean;
}
