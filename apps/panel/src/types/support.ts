export type TicketStatus =
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'WAITING_CUSTOMER'
  | 'RESOLVED'
  | 'CLOSED';

export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface TicketMessage {
  id: string;
  userId: string;
  userName: string;
  content: string;
  isInternal: boolean;
  createdAt: string;
}

export interface SupportTicketListItem {
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

export interface SupportTicketDetail extends SupportTicketListItem {
  assignedTo: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  messages: TicketMessage[];
}

export interface AdminSupportTicketListItem extends SupportTicketListItem {
  organizationId: string;
  organizationName: string;
  userName: string;
  userEmail: string;
  assignedTo: string | null;
  slaHours: number;
  slaDays: number;
}

export interface SupportStats {
  open: number;
  inProgress: number;
  waitingCustomer: number;
  resolved: number;
  closed: number;
  totalOpen: number;
  avgFirstResponseHours: number | null;
  avgResolutionHours: number | null;
}

export interface SupportSlaReport {
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
