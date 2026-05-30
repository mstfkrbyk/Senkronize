import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Prisma,
  TicketPriority,
  TicketStatus,
  UserRole,
  type TicketCategory,
  type TicketPriority as TicketPriorityType,
} from '@prisma/client';

import { EmailService } from '../notifications/email/email.service';
import { PrismaService } from '../prisma/prisma.service';

import type {
  AdminSupportTicketListItemDto,
  SupportSlaReportDto,
  SupportStatsDto,
  SupportTicketDetailDto,
  SupportTicketListItemDto,
  TicketMessageDto,
} from './support.types';
import type {
  AdminTicketQueryDto,
  CreateSupportTicketDto,
  SupportTicketQueryDto,
  UpdateAdminTicketDto,
} from './support.dto';

const MS_PER_HOUR = 3_600_000;
const FIRST_RESPONSE_SLA_HOURS = 24;
const URGENT_FIRST_RESPONSE_SLA_HOURS = 4;
const RESOLUTION_SLA_HOURS = 72;
const URGENT_RESOLUTION_SLA_HOURS = 48;

const TICKET_INCLUDE_MESSAGES = {
  messages: {
    orderBy: { createdAt: 'asc' as const },
    include: {
      user: { select: { id: true, name: true, role: true } },
    },
  },
  user: { select: { id: true, name: true, email: true } },
} satisfies Prisma.SupportTicketInclude;

@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly config: ConfigService,
  ) {}

  private panelBaseUrl(): string {
    return this.config.get<string>('PANEL_URL') ?? 'https://app.senkronize.com';
  }

  private opsAlertEmail(): string | undefined {
    return this.config.get<string>('OPS_ALERT_EMAIL')?.trim() || undefined;
  }

  private buildDateFilter(
    dateFrom?: string,
    dateTo?: string,
  ): Prisma.DateTimeFilter | undefined {
    if (!dateFrom && !dateTo) {
      return undefined;
    }
    const filter: Prisma.DateTimeFilter = {};
    if (dateFrom) {
      filter.gte = new Date(dateFrom);
    }
    if (dateTo) {
      filter.lte = new Date(dateTo);
    }
    return filter;
  }

  private async generateTicketNumber(): Promise<string> {
    const count = await this.prisma.supportTicket.count();
    const seq = String(count + 1).padStart(6, '0');
    return `TKT-${seq}`;
  }

  private mapMessage(
    msg: {
      id: string;
      userId: string;
      content: string;
      isInternal: boolean;
      createdAt: Date;
      user: { name: string };
    },
    includeInternal: boolean,
  ): TicketMessageDto | null {
    if (msg.isInternal && !includeInternal) {
      return null;
    }
    return {
      id: msg.id,
      userId: msg.userId,
      userName: msg.user.name,
      content: msg.content,
      isInternal: msg.isInternal,
      createdAt: msg.createdAt.toISOString(),
    };
  }

  private mapListItem(
    ticket: {
      id: string;
      ticketNumber: string;
      subject: string;
      status: TicketStatus;
      priority: TicketPriorityType;
      category: TicketCategory | null;
      createdAt: Date;
      updatedAt: Date;
      messages: { content: string; createdAt: Date; isInternal: boolean }[];
    },
    includeInternal: boolean,
  ): SupportTicketListItemDto {
    const visibleMessages = ticket.messages.filter(
      (m) => includeInternal || !m.isInternal,
    );
    const last = visibleMessages[visibleMessages.length - 1];
    return {
      id: ticket.id,
      ticketNumber: ticket.ticketNumber,
      subject: ticket.subject,
      status: ticket.status,
      priority: ticket.priority,
      category: ticket.category,
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString(),
      lastMessage: last?.content ?? null,
      lastMessageAt: last?.createdAt.toISOString() ?? null,
    };
  }

  private slaFromCreated(createdAt: Date): { slaHours: number; slaDays: number } {
    const elapsedMs = Date.now() - createdAt.getTime();
    const slaHours = Math.floor(elapsedMs / MS_PER_HOUR);
    const slaDays = Math.floor(slaHours / 24);
    return { slaHours, slaDays };
  }

  private firstResponseSlaHours(priority: TicketPriorityType): number {
    return priority === TicketPriority.URGENT
      ? URGENT_FIRST_RESPONSE_SLA_HOURS
      : FIRST_RESPONSE_SLA_HOURS;
  }

  private resolutionSlaHours(priority: TicketPriorityType): number {
    return priority === TicketPriority.URGENT
      ? URGENT_RESOLUTION_SLA_HOURS
      : RESOLUTION_SLA_HOURS;
  }

  async createTicket(
    organizationId: string,
    userId: string,
    dto: CreateSupportTicketDto,
  ): Promise<SupportTicketDetailDto> {
    const ticketNumber = await this.generateTicketNumber();
    const user = await this.prisma.user.findFirst({
      where: { id: userId, organizationId, deletedAt: null },
    });
    if (!user) {
      throw new NotFoundException('Kullanıcı bulunamadı');
    }

    const ticket = await this.prisma.$transaction(async (tx) => {
      const created = await tx.supportTicket.create({
        data: {
          organizationId,
          userId,
          ticketNumber,
          subject: dto.subject.trim(),
          status: TicketStatus.OPEN,
          priority: dto.priority,
          category: dto.category ?? null,
          messages: {
            create: {
              userId,
              content: dto.content.trim(),
              isInternal: false,
            },
          },
        },
        include: TICKET_INCLUDE_MESSAGES,
      });
      return created;
    });

    const detail = this.mapDetail(ticket, false);

    await this.emailService.sendNewTicketNotification(
      user.email,
      ticket.ticketNumber,
      ticket.subject,
    );

    const opsEmail = this.opsAlertEmail();
    if (opsEmail) {
      const org = await this.prisma.organization.findUnique({
        where: { id: organizationId },
        select: { name: true },
      });
      await this.emailService.sendSupportTicketAdminAlert(opsEmail, {
        ticketNumber: ticket.ticketNumber,
        subject: ticket.subject,
        organizationName: org?.name ?? organizationId,
        userName: user.name,
        userEmail: user.email,
        priority: ticket.priority,
        adminUrl: `${this.panelBaseUrl()}/admin/support/tickets`,
      });
    }

    return detail;
  }

  async getTickets(
    organizationId: string,
    userId: string,
    filters: SupportTicketQueryDto,
  ): Promise<{ data: SupportTicketListItemDto[] }> {
    const createdAt = this.buildDateFilter(filters.dateFrom, filters.dateTo);
    const where: Prisma.SupportTicketWhereInput = {
      organizationId,
      userId,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.priority ? { priority: filters.priority } : {}),
      ...(createdAt ? { createdAt } : {}),
    };

    const tickets = await this.prisma.supportTicket.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        messages: {
          where: { isInternal: false },
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: { content: true, createdAt: true, isInternal: true },
        },
      },
    });

    const withLastMessage = await Promise.all(
      tickets.map(async (t) => {
        const lastMsg = await this.prisma.ticketMessage.findFirst({
          where: { ticketId: t.id, isInternal: false },
          orderBy: { createdAt: 'desc' },
          select: { content: true, createdAt: true, isInternal: true },
        });
        return this.mapListItem(
          {
            ...t,
            messages: lastMsg ? [lastMsg] : [],
          },
          false,
        );
      }),
    );

    return { data: withLastMessage };
  }

  async getTicket(
    organizationId: string,
    userId: string,
    ticketId: string,
    includeInternal = false,
  ): Promise<SupportTicketDetailDto> {
    const ticket = await this.prisma.supportTicket.findFirst({
      where: {
        id: ticketId,
        organizationId,
        userId,
      },
      include: TICKET_INCLUDE_MESSAGES,
    });
    if (!ticket) {
      throw new NotFoundException('Destek talebi bulunamadı');
    }
    return this.mapDetail(ticket, includeInternal);
  }

  async getTicketForAdmin(ticketId: string): Promise<SupportTicketDetailDto> {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: TICKET_INCLUDE_MESSAGES,
    });
    if (!ticket) {
      throw new NotFoundException('Destek talebi bulunamadı');
    }
    return this.mapDetail(ticket, true);
  }

  private mapDetail(
    ticket: Prisma.SupportTicketGetPayload<{
      include: typeof TICKET_INCLUDE_MESSAGES;
    }>,
    includeInternal: boolean,
  ): SupportTicketDetailDto {
    const messages = ticket.messages
      .map((m) => this.mapMessage(m, includeInternal))
      .filter((m): m is TicketMessageDto => m !== null);

    return {
      id: ticket.id,
      ticketNumber: ticket.ticketNumber,
      subject: ticket.subject,
      status: ticket.status,
      priority: ticket.priority,
      category: ticket.category,
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString(),
      lastMessage: messages[messages.length - 1]?.content ?? null,
      lastMessageAt: messages[messages.length - 1]?.createdAt ?? null,
      assignedTo: ticket.assignedTo,
      firstResponseAt: ticket.firstResponseAt?.toISOString() ?? null,
      resolvedAt: ticket.resolvedAt?.toISOString() ?? null,
      closedAt: ticket.closedAt?.toISOString() ?? null,
      messages,
    };
  }

  async addMessage(
    organizationId: string,
    ticketId: string,
    userId: string,
    content: string,
    options?: { isInternal?: boolean; skipOrgUserCheck?: boolean },
  ): Promise<SupportTicketDetailDto> {
    const ticket = await this.prisma.supportTicket.findFirst({
      where: options?.skipOrgUserCheck
        ? { id: ticketId }
        : { id: ticketId, organizationId, userId },
    });
    if (!ticket) {
      throw new NotFoundException('Destek talebi bulunamadı');
    }
    if (ticket.status === TicketStatus.CLOSED) {
      throw new BadRequestException('Kapalı talebe mesaj eklenemez');
    }

    const author = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });
    if (!author) {
      throw new NotFoundException('Kullanıcı bulunamadı');
    }

    const isInternal = options?.isInternal === true;
    const isAdminReply =
      author.role === UserRole.SUPER_ADMIN && !isInternal;
    const now = new Date();

    const ticketUpdate: Prisma.SupportTicketUpdateInput = {
      updatedAt: now,
    };

    if (isAdminReply) {
      if (!ticket.firstResponseAt) {
        ticketUpdate.firstResponseAt = now;
      }
      if (
        ticket.status === TicketStatus.OPEN ||
        ticket.status === TicketStatus.IN_PROGRESS
      ) {
        ticketUpdate.status = TicketStatus.WAITING_CUSTOMER;
      }
    } else if (
      !isInternal &&
      author.role !== UserRole.SUPER_ADMIN &&
      ticket.status === TicketStatus.WAITING_CUSTOMER
    ) {
      ticketUpdate.status = TicketStatus.OPEN;
    }

    await this.prisma.$transaction([
      this.prisma.ticketMessage.create({
        data: {
          ticketId,
          userId,
          content: content.trim(),
          isInternal,
        },
      }),
      this.prisma.supportTicket.update({
        where: { id: ticketId },
        data: ticketUpdate,
      }),
    ]);

    if (!isInternal && isAdminReply) {
      const ticketOwner = await this.prisma.user.findFirst({
        where: { id: ticket.userId, deletedAt: null },
        select: { email: true },
      });
      if (ticketOwner?.email) {
        await this.emailService.sendTicketReplyNotification(
          ticketOwner.email,
          ticket.ticketNumber,
        );
      }
    } else if (!isInternal && author.role !== UserRole.SUPER_ADMIN) {
      const opsEmail = this.opsAlertEmail();
      if (opsEmail) {
        const org = await this.prisma.organization.findUnique({
          where: { id: ticket.organizationId },
          select: { name: true },
        });
        await this.emailService.sendSupportTicketCustomerReplyAlert(opsEmail, {
          ticketNumber: ticket.ticketNumber,
          subject: ticket.subject,
          organizationName: org?.name ?? ticket.organizationId,
          userName: author.name,
          adminUrl: `${this.panelBaseUrl()}/admin/support/tickets`,
        });
      }
    }

    if (options?.skipOrgUserCheck) {
      return this.getTicketForAdmin(ticketId);
    }
    return this.getTicket(organizationId, userId, ticketId, false);
  }

  async addAdminMessage(
    ticketId: string,
    adminUserId: string,
    content: string,
    isInternal: boolean,
  ): Promise<SupportTicketDetailDto> {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
    });
    if (!ticket) {
      throw new NotFoundException('Destek talebi bulunamadı');
    }
    return this.addMessage(
      ticket.organizationId,
      ticketId,
      adminUserId,
      content,
      { isInternal, skipOrgUserCheck: true },
    );
  }

  async addInternalNote(
    ticketId: string,
    adminUserId: string,
    content: string,
  ): Promise<SupportTicketDetailDto> {
    return this.addAdminMessage(ticketId, adminUserId, content, true);
  }

  async closeTicket(
    organizationId: string,
    userId: string,
    ticketId: string,
  ): Promise<SupportTicketDetailDto> {
    const ticket = await this.prisma.supportTicket.findFirst({
      where: { id: ticketId, organizationId, userId },
    });
    if (!ticket) {
      throw new NotFoundException('Destek talebi bulunamadı');
    }
    if (ticket.status === TicketStatus.CLOSED) {
      return this.getTicket(organizationId, userId, ticketId, false);
    }

    await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        status: TicketStatus.CLOSED,
        closedAt: new Date(),
      },
    });

    return this.getTicket(organizationId, userId, ticketId, false);
  }

  async updateStatus(
    ticketId: string,
    status: TicketStatus,
  ): Promise<SupportTicketDetailDto> {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
    });
    if (!ticket) {
      throw new NotFoundException('Destek talebi bulunamadı');
    }

    const now = new Date();
    await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        status,
        resolvedAt:
          status === TicketStatus.RESOLVED || status === TicketStatus.CLOSED
            ? (ticket.resolvedAt ?? now)
            : ticket.resolvedAt,
        closedAt:
          status === TicketStatus.CLOSED ? (ticket.closedAt ?? now) : ticket.closedAt,
      },
    });

    if (status !== ticket.status) {
      const owner = await this.prisma.user.findFirst({
        where: { id: ticket.userId, deletedAt: null },
        select: { email: true },
      });
      if (owner?.email) {
        await this.emailService.sendTicketStatusUpdate(
          owner.email,
          ticket.ticketNumber,
          status,
        );
      }
    }

    return this.getTicketForAdmin(ticketId);
  }

  async updateTicketAdmin(
    ticketId: string,
    dto: UpdateAdminTicketDto,
  ): Promise<SupportTicketDetailDto> {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
    });
    if (!ticket) {
      throw new NotFoundException('Destek talebi bulunamadı');
    }

    if (
      dto.status === undefined &&
      dto.priority === undefined &&
      dto.assignedTo === undefined
    ) {
      throw new BadRequestException('Güncellenecek en az bir alan gerekli');
    }

    const now = new Date();
    const data: Prisma.SupportTicketUpdateInput = {};

    if (dto.status !== undefined) {
      data.status = dto.status;
      if (
        dto.status === TicketStatus.RESOLVED ||
        dto.status === TicketStatus.CLOSED
      ) {
        data.resolvedAt = ticket.resolvedAt ?? now;
      }
      if (dto.status === TicketStatus.CLOSED) {
        data.closedAt = ticket.closedAt ?? now;
      }
    }

    if (dto.priority !== undefined) {
      data.priority = dto.priority;
    }

    if (dto.assignedTo !== undefined) {
      if (dto.assignedTo === null) {
        data.assignedTo = null;
      } else {
        const admin = await this.prisma.user.findFirst({
          where: {
            id: dto.assignedTo,
            role: UserRole.SUPER_ADMIN,
            deletedAt: null,
          },
        });
        if (!admin) {
          throw new BadRequestException('Geçersiz admin kullanıcısı');
        }
        data.assignedTo = dto.assignedTo;
        if (
          ticket.status === TicketStatus.OPEN &&
          dto.status === undefined
        ) {
          data.status = TicketStatus.IN_PROGRESS;
        }
      }
    }

    await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data,
    });

    if (dto.status !== undefined && dto.status !== ticket.status) {
      const owner = await this.prisma.user.findFirst({
        where: { id: ticket.userId, deletedAt: null },
        select: { email: true },
      });
      if (owner?.email) {
        await this.emailService.sendTicketStatusUpdate(
          owner.email,
          ticket.ticketNumber,
          dto.status,
        );
      }
    }

    if (
      dto.assignedTo &&
      dto.assignedTo !== ticket.assignedTo
    ) {
      const assignee = await this.prisma.user.findFirst({
        where: { id: dto.assignedTo, deletedAt: null },
        select: { email: true, name: true },
      });
      if (assignee?.email) {
        await this.emailService.sendTicketAssignmentNotification(
          assignee.email,
          {
            assigneeName: assignee.name,
            ticketNumber: ticket.ticketNumber,
            subject: ticket.subject,
            adminUrl: `${this.panelBaseUrl()}/admin/support/tickets/${ticketId}`,
          },
        );
      }
    }

    return this.getTicketForAdmin(ticketId);
  }

  async assignTicket(
    ticketId: string,
    adminId: string,
  ): Promise<SupportTicketDetailDto> {
    return this.updateTicketAdmin(ticketId, { assignedTo: adminId });
  }

  async getAdminTickets(
    filters: AdminTicketQueryDto,
  ): Promise<{ data: AdminSupportTicketListItemDto[] }> {
    const createdAt = this.buildDateFilter(filters.dateFrom, filters.dateTo);
    const where: Prisma.SupportTicketWhereInput = {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.priority ? { priority: filters.priority } : {}),
      ...(filters.organizationId
        ? { organizationId: filters.organizationId }
        : {}),
      ...(filters.assignedTo ? { assignedTo: filters.assignedTo } : {}),
      ...(createdAt ? { createdAt } : {}),
    };

    const tickets = await this.prisma.supportTicket.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        organization: { select: { id: true, name: true } },
        user: { select: { name: true, email: true } },
        messages: {
          where: { isInternal: false },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { content: true, createdAt: true, isInternal: true },
        },
      },
    });

    return {
      data: tickets.map((t) => {
        const { slaHours, slaDays } = this.slaFromCreated(t.createdAt);
        const last = t.messages[0];
        return {
          id: t.id,
          ticketNumber: t.ticketNumber,
          subject: t.subject,
          status: t.status,
          priority: t.priority,
          category: t.category,
          createdAt: t.createdAt.toISOString(),
          updatedAt: t.updatedAt.toISOString(),
          lastMessage: last?.content ?? null,
          lastMessageAt: last?.createdAt.toISOString() ?? null,
          organizationId: t.organization.id,
          organizationName: t.organization.name,
          userName: t.user.name,
          userEmail: t.user.email,
          assignedTo: t.assignedTo,
          firstResponseAt: t.firstResponseAt?.toISOString() ?? null,
          slaHours,
          slaDays,
        };
      }),
    };
  }

  async getSupportStats(): Promise<{ data: SupportStatsDto }> {
    const statusCounts = await this.prisma.supportTicket.groupBy({
      by: ['status'],
      _count: { _all: true },
    });

    const countByStatus = (status: TicketStatus): number =>
      statusCounts.find((s) => s.status === status)?._count._all ?? 0;

    const open = countByStatus(TicketStatus.OPEN);
    const inProgress = countByStatus(TicketStatus.IN_PROGRESS);
    const waitingCustomer = countByStatus(TicketStatus.WAITING_CUSTOMER);

    return {
      data: {
        open,
        inProgress,
        waitingCustomer,
        resolved: countByStatus(TicketStatus.RESOLVED),
        closed: countByStatus(TicketStatus.CLOSED),
        totalOpen: open + inProgress + waitingCustomer,
      },
    };
  }

  async getSlaReport(): Promise<{ data: SupportSlaReportDto }> {
    const tickets = await this.prisma.supportTicket.findMany({
      select: {
        priority: true,
        createdAt: true,
        firstResponseAt: true,
        resolvedAt: true,
      },
    });

    let firstResponseCompliant = 0;
    let firstResponseTotal = 0;
    let firstResponseHoursSum = 0;

    let resolutionCompliant = 0;
    let resolutionTotal = 0;
    let resolutionHoursSum = 0;

    for (const ticket of tickets) {
      if (ticket.firstResponseAt) {
        firstResponseTotal += 1;
        const hours =
          (ticket.firstResponseAt.getTime() - ticket.createdAt.getTime()) /
          MS_PER_HOUR;
        firstResponseHoursSum += hours;
        if (hours <= this.firstResponseSlaHours(ticket.priority)) {
          firstResponseCompliant += 1;
        }
      }

      if (ticket.resolvedAt) {
        resolutionTotal += 1;
        const hours =
          (ticket.resolvedAt.getTime() - ticket.createdAt.getTime()) /
          MS_PER_HOUR;
        resolutionHoursSum += hours;
        if (hours <= this.resolutionSlaHours(ticket.priority)) {
          resolutionCompliant += 1;
        }
      }
    }

    return {
      data: {
        totalTickets: tickets.length,
        resolvedTickets: resolutionTotal,
        avgFirstResponseHours:
          firstResponseTotal > 0
            ? Math.round((firstResponseHoursSum / firstResponseTotal) * 10) / 10
            : null,
        avgResolutionHours:
          resolutionTotal > 0
            ? Math.round((resolutionHoursSum / resolutionTotal) * 10) / 10
            : null,
        firstResponseComplianceRate:
          firstResponseTotal > 0
            ? Math.round((firstResponseCompliant / firstResponseTotal) * 1000) /
              10
            : 0,
        resolutionComplianceRate:
          resolutionTotal > 0
            ? Math.round((resolutionCompliant / resolutionTotal) * 1000) / 10
            : 0,
        slaTargets: {
          firstResponseHours: FIRST_RESPONSE_SLA_HOURS,
          urgentFirstResponseHours: URGENT_FIRST_RESPONSE_SLA_HOURS,
          resolutionHours: RESOLUTION_SLA_HOURS,
          urgentResolutionHours: URGENT_RESOLUTION_SLA_HOURS,
        },
      },
    };
  }

  async escalateUnansweredTickets(): Promise<void> {
    const threshold = new Date(Date.now() - 48 * MS_PER_HOUR);
    const result = await this.prisma.supportTicket.updateMany({
      where: {
        status: {
          in: [
            TicketStatus.OPEN,
            TicketStatus.IN_PROGRESS,
            TicketStatus.WAITING_CUSTOMER,
          ],
        },
        firstResponseAt: null,
        createdAt: { lt: threshold },
        priority: { not: TicketPriority.URGENT },
      },
      data: { priority: TicketPriority.URGENT },
    });

    if (result.count > 0) {
      this.logger.log(
        `${String(result.count)} talep 48 saat yanıtsız kaldığı için URGENT yapıldı`,
      );
    }
  }

  async autoCloseInactiveTickets(): Promise<void> {
    const threshold = new Date(Date.now() - 7 * 24 * MS_PER_HOUR);
    const inactive = await this.prisma.supportTicket.findMany({
      where: {
        status: {
          in: [
            TicketStatus.OPEN,
            TicketStatus.IN_PROGRESS,
            TicketStatus.WAITING_CUSTOMER,
            TicketStatus.RESOLVED,
          ],
        },
        updatedAt: { lt: threshold },
      },
      select: { id: true, userId: true, ticketNumber: true, status: true },
    });

    if (inactive.length === 0) {
      return;
    }

    const now = new Date();
    await this.prisma.supportTicket.updateMany({
      where: { id: { in: inactive.map((t) => t.id) } },
      data: {
        status: TicketStatus.CLOSED,
        closedAt: now,
        resolvedAt: now,
      },
    });

    for (const ticket of inactive) {
      const owner = await this.prisma.user.findFirst({
        where: { id: ticket.userId, deletedAt: null },
        select: { email: true },
      });
      if (owner?.email) {
        await this.emailService.sendTicketStatusUpdate(
          owner.email,
          ticket.ticketNumber,
          TicketStatus.CLOSED,
        );
      }
    }

    this.logger.log(
      `${String(inactive.length)} talep 7 gün hareketsiz kaldığı için otomatik kapatıldı`,
    );
  }

  async sendStaleTicketReminders(): Promise<void> {
    const opsEmail = this.opsAlertEmail();
    if (!opsEmail) {
      return;
    }

    const threshold = new Date(Date.now() - 3 * 24 * MS_PER_HOUR);
    const openTickets = await this.prisma.supportTicket.findMany({
      where: {
        status: { in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS] },
      },
      include: {
        organization: { select: { name: true } },
        messages: {
          where: { isInternal: false },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { user: { select: { role: true, name: true } } },
        },
      },
    });

    const stale = openTickets.filter((t) => {
      const last = t.messages[0];
      if (!last) {
        return t.createdAt < threshold;
      }
      if (last.user.role === UserRole.SUPER_ADMIN) {
        return false;
      }
      return last.createdAt < threshold;
    });

    if (stale.length === 0) {
      return;
    }

    await this.emailService.sendSupportStaleTicketsReminder(opsEmail, {
      count: stale.length,
      tickets: stale.slice(0, 20).map((t) => ({
        ticketNumber: t.ticketNumber,
        subject: t.subject,
        organizationName: t.organization.name,
        daysWaiting: Math.floor(
          (Date.now() - (t.messages[0]?.createdAt ?? t.createdAt).getTime()) /
            (24 * MS_PER_HOUR),
        ),
      })),
      adminUrl: `${this.panelBaseUrl()}/admin/support/tickets`,
    });

    this.logger.log(`Bekleyen ${String(stale.length)} destek talebi hatırlatması gönderildi`);
  }
}
