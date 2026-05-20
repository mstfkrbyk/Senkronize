import {
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from '@prisma/client';
import {
  IsDateString,
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
  @IsEnum(TicketCategory)
  category?: TicketCategory;

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

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;
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

  @IsOptional()
  @IsString()
  assignedTo?: string;
}

export class UpdateTicketStatusDto {
  @IsEnum(TicketStatus)
  status!: TicketStatus;
}

export class UpdateAdminTicketDto {
  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;

  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @IsOptional()
  @IsString()
  assignedTo?: string | null;
}

export class AssignTicketDto {
  @IsString()
  @IsNotEmpty()
  adminId!: string;
}

export class InternalNoteDto {
  @IsString()
  @IsNotEmpty()
  content!: string;
}

export class AdminAddTicketMessageDto extends AddTicketMessageDto {
  @IsOptional()
  isInternal?: boolean;
}
