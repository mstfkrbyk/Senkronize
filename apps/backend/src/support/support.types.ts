import type {
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from '@prisma/client';

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
  category: TicketCategory | null;
  createdAt: string;
  updatedAt: string;
  lastMessage: string | null;
  lastMessageAt: string | null;
}

export interface SupportTicketDetailDto extends SupportTicketListItemDto {
  assignedTo: string | null;
  firstResponseAt: string | null;
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
  firstResponseAt: string | null;
  slaHours: number;
  slaDays: number;
}

export interface SupportStatsDto {
  open: number;
  inProgress: number;
  waitingCustomer: number;
  resolved: number;
  closed: number;
  totalOpen: number;
  avgFirstResponseHours: number | null;
  avgResolutionHours: number | null;
}

export interface SupportSlaReportDto {
  totalTickets: number;
  resolvedTickets: number;
  avgFirstResponseHours: number | null;
  avgResolutionHours: number | null;
  firstResponseComplianceRate: number;
  resolutionComplianceRate: number;
  slaTargets: {
    firstResponseHours: number;
    urgentFirstResponseHours: number;
    resolutionHours: number;
    urgentResolutionHours: number;
  };
}
