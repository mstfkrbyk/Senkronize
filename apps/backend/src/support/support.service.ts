import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Prisma,
  TicketStatus,
  UserRole,
  type TicketPriority,
} from '@prisma/client';

import { EmailService } from '../notifications/email/email.service';
import { PrismaService } from '../prisma/prisma.service';

import type {
  AdminSupportTicketListItemDto,
  SupportTicketDetailDto,
  SupportTicketListItemDto,
  TicketMessageDto,
} from './support.types';
import type {
  AdminTicketQueryDto,
  CreateSupportTicketDto,
  SupportTicketQueryDto,
} from './support.dto';

const MS_PER_HOUR = 3_600_000;

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
      priority: TicketPriority;
      category: string | null;
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
          category: dto.category?.trim() || null,
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
        adminUrl: `${this.panelBaseUrl()}/admin/tickets`,
      });
    }

    return detail;
  }

  async getTickets(
    organizationId: string,
    userId: string,
    filters: SupportTicketQueryDto,
  ): Promise<{ data: SupportTicketListItemDto[] }> {
    const where: Prisma.SupportTicketWhereInput = {
      organizationId,
      userId,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.priority ? { priority: filters.priority } : {}),
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
        data: {
          updatedAt: new Date(),
          ...(author.role !== UserRole.SUPER_ADMIN &&
          !isInternal &&
          ticket.status === TicketStatus.WAITING_CUSTOMER
            ? { status: TicketStatus.OPEN }
            : {}),
        },
      }),
    ]);

    if (!isInternal && author.role === UserRole.SUPER_ADMIN) {
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
          adminUrl: `${this.panelBaseUrl()}/admin/tickets`,
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

  async assignTicket(
    ticketId: string,
    adminId: string,
  ): Promise<SupportTicketDetailDto> {
    const admin = await this.prisma.user.findFirst({
      where: { id: adminId, role: UserRole.SUPER_ADMIN, deletedAt: null },
    });
    if (!admin) {
      throw new BadRequestException('Geçersiz admin kullanıcısı');
    }

    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
    });
    if (!ticket) {
      throw new NotFoundException('Destek talebi bulunamadı');
    }

    await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        assignedTo: adminId,
        status:
          ticket.status === TicketStatus.OPEN
            ? TicketStatus.IN_PROGRESS
            : ticket.status,
      },
    });

    return this.getTicketForAdmin(ticketId);
  }

  async getAdminTickets(
    filters: AdminTicketQueryDto,
  ): Promise<{ data: AdminSupportTicketListItemDto[] }> {
    const where: Prisma.SupportTicketWhereInput = {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.priority ? { priority: filters.priority } : {}),
      ...(filters.organizationId
        ? { organizationId: filters.organizationId }
        : {}),
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
          slaHours,
          slaDays,
        };
      }),
    };
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
      adminUrl: `${this.panelBaseUrl()}/admin/tickets`,
    });

    this.logger.log(`Bekleyen ${String(stale.length)} destek talebi hatırlatması gönderildi`);
  }
}
