import type { TicketPriority, TicketStatus } from '@prisma/client';

export interface TicketMessageDto {
  id: string;
  userId: string;
  userName: string;
  content: string;
  isInternal: boolean;
  createdAt: string;
}

export interface SupportTicketListItemDto {
  id: string;
  ticketNumber: string;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: string | null;
  createdAt: string;
  updatedAt: string;
  lastMessage: string | null;
  lastMessageAt: string | null;
}

export interface SupportTicketDetailDto extends SupportTicketListItemDto {
  assignedTo: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  messages: TicketMessageDto[];
}

export interface AdminSupportTicketListItemDto extends SupportTicketListItemDto {
  organizationId: string;
  organizationName: string;
  userName: string;
  userEmail: string;
  assignedTo: string | null;
  slaHours: number;
  slaDays: number;
}
