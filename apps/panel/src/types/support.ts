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
