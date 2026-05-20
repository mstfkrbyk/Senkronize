import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  type Customer,
  type Order,
  Prisma,
} from '@prisma/client';
import Papa from 'papaparse';

import { PrismaService } from '../prisma/prisma.service';

import type { CustomerQueryDto } from './customer.dto';
import type {
  CustomerDetail,
  CustomerSegmentKey,
  CustomerSegmentsSummary,
  SerializedCustomer,
} from './customer.types';

const SEGMENT_KEYS: CustomerSegmentKey[] = ['VIP', 'sadik', 'yeni', 'riskAlti'];

function thirtyDaysAgo(): Date {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  return date;
}

export function computeCustomerSegments(customer: {
  totalOrders: number;
  lastOrderAt: Date | null;
}): CustomerSegmentKey[] {
  const segments: CustomerSegmentKey[] = [];
  if (customer.totalOrders >= 10) {
    segments.push('VIP');
  }
  if (customer.totalOrders >= 5) {
    segments.push('sadik');
  }
  if (customer.totalOrders <= 2) {
    segments.push('yeni');
  }
  const cutoff = thirtyDaysAgo();
  if (
    customer.totalOrders > 2 &&
    customer.lastOrderAt !== null &&
    customer.lastOrderAt < cutoff
  ) {
    segments.push('riskAlti');
  }
  return segments;
}

function segmentWhere(segment: CustomerSegmentKey): Prisma.CustomerWhereInput {
  switch (segment) {
    case 'VIP':
      return { totalOrders: { gte: 10 } };
    case 'sadik':
      return { totalOrders: { gte: 5 } };
    case 'yeni':
      return { totalOrders: { lte: 2 } };
    case 'riskAlti':
      return {
        totalOrders: { gt: 2 },
        lastOrderAt: { lt: thirtyDaysAgo() },
      };
    default: {
      const _exhaustive: never = segment;
      return _exhaustive;
    }
  }
}

function parseCityFromAddress(address: string | null | undefined): string | null {
  if (!address || address.trim().length === 0) {
    return null;
  }
  const parts = address.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return parts[parts.length - 2] ?? null;
  }
  return parts[0] ?? null;
}

function serializeCustomer(row: Customer): SerializedCustomer {
  return {
    id: row.id,
    organizationId: row.organizationId,
    externalId: row.externalId,
    platform: row.platform,
    name: row.name,
    email: row.email,
    phone: row.phone,
    city: row.city,
    country: row.country,
    totalOrders: row.totalOrders,
    totalSpent: row.totalSpent.toString(),
    firstOrderAt: row.firstOrderAt?.toISOString() ?? null,
    lastOrderAt: row.lastOrderAt?.toISOString() ?? null,
    tags: row.tags,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    segments: computeCustomerSegments(row),
  };
}

@Injectable()
export class CustomerService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    organizationId: string,
    filters: CustomerQueryDto,
  ): Promise<{ items: SerializedCustomer[]; total: number; page: number; limit: number }> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const skip = (page - 1) * limit;

    const lastOrderAt: Prisma.DateTimeFilter = {};
    if (filters.startDate) {
      lastOrderAt.gte = new Date(filters.startDate);
    }
    if (filters.endDate) {
      const end = new Date(filters.endDate);
      end.setHours(23, 59, 59, 999);
      lastOrderAt.lte = end;
    }

    const where: Prisma.CustomerWhereInput = {
      organizationId,
      deletedAt: null,
      ...(filters.platform ? { platform: filters.platform } : {}),
      ...(filters.city
        ? {
            city: {
              contains: filters.city.trim(),
              mode: Prisma.QueryMode.insensitive,
            },
          }
        : {}),
      ...(filters.segment ? segmentWhere(filters.segment) : {}),
      ...(Object.keys(lastOrderAt).length > 0 ? { lastOrderAt } : {}),
      ...(filters.search
        ? {
            OR: [
              {
                name: {
                  contains: filters.search.trim(),
                  mode: Prisma.QueryMode.insensitive,
                },
              },
              {
                email: {
                  contains: filters.search.trim(),
                  mode: Prisma.QueryMode.insensitive,
                },
              },
              {
                phone: {
                  contains: filters.search.trim(),
                  mode: Prisma.QueryMode.insensitive,
                },
              },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        orderBy: [{ lastOrderAt: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.customer.count({ where }),
    ]);

    return {
      items: rows.map(serializeCustomer),
      total,
      page,
      limit,
    };
  }

  async findOne(organizationId: string, id: string): Promise<CustomerDetail> {
    const customer = await this.prisma.customer.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!customer) {
      throw new NotFoundException('Müşteri bulunamadı');
    }

    const orderWhere: Prisma.OrderWhereInput = {
      organizationId,
      deletedAt: null,
      customerName: customer.name,
      ...(customer.platform ? { platform: customer.platform } : {}),
      ...(customer.phone
        ? { customerPhone: customer.phone }
        : {}),
    };

    const orders = await this.prisma.order.findMany({
      where: orderWhere,
      orderBy: { platformCreatedAt: 'desc' },
      take: 50,
      select: {
        id: true,
        platformOrderId: true,
        platform: true,
        status: true,
        totalAmount: true,
        currency: true,
        platformCreatedAt: true,
      },
    });

    const totalSpentNum = Number(customer.totalSpent);
    const aov =
      customer.totalOrders > 0
        ? (totalSpentNum / customer.totalOrders).toFixed(2)
        : '0.00';

    return {
      ...serializeCustomer(customer),
      averageOrderValue: aov,
      orders: orders.map((o) => ({
        id: o.id,
        platformOrderId: o.platformOrderId,
        platform: o.platform,
        status: o.status,
        totalAmount: o.totalAmount.toString(),
        currency: o.currency,
        platformCreatedAt: o.platformCreatedAt.toISOString(),
      })),
    };
  }

  async upsertFromOrder(order: Order): Promise<Customer> {
    const orderDate = order.platformCreatedAt;
    const amount = order.totalAmount;
    const city = parseCityFromAddress(order.shippingAddress);

    const baseWhere: Prisma.CustomerWhereInput = {
      organizationId: order.organizationId,
      platform: order.platform,
      deletedAt: null,
      name: order.customerName,
    };

    let customer = order.customerPhone
      ? await this.prisma.customer.findFirst({
          where: { ...baseWhere, phone: order.customerPhone },
        })
      : null;

    if (!customer) {
      customer = await this.prisma.customer.findFirst({
        where: baseWhere,
        orderBy: { createdAt: 'asc' },
      });
    }

    if (customer) {
      return this.prisma.customer.update({
        where: { id: customer.id },
        data: {
          totalOrders: { increment: 1 },
          totalSpent: { increment: amount },
          lastOrderAt: orderDate,
          firstOrderAt: customer.firstOrderAt ?? orderDate,
          phone: order.customerPhone ?? customer.phone,
          city: city ?? customer.city,
        },
      });
    }

    return this.prisma.customer.create({
      data: {
        organizationId: order.organizationId,
        platform: order.platform,
        name: order.customerName,
        phone: order.customerPhone,
        city,
        totalOrders: 1,
        totalSpent: amount,
        firstOrderAt: orderDate,
        lastOrderAt: orderDate,
        tags: [],
      },
    });
  }

  async getSegments(organizationId: string): Promise<CustomerSegmentsSummary> {
    const baseWhere: Prisma.CustomerWhereInput = {
      organizationId,
      deletedAt: null,
    };

    const results = await Promise.all(
      SEGMENT_KEYS.map(async (key) => {
        const where: Prisma.CustomerWhereInput = {
          ...baseWhere,
          ...segmentWhere(key),
        };
        const agg = await this.prisma.customer.aggregate({
          where,
          _count: { _all: true },
          _sum: { totalSpent: true },
        });
        return {
          key,
          count: agg._count._all,
          totalRevenue: (agg._sum.totalSpent ?? new Prisma.Decimal(0)).toString(),
        };
      }),
    );

    return results.reduce<CustomerSegmentsSummary>(
      (acc, row) => {
        acc[row.key] = {
          count: row.count,
          totalRevenue: row.totalRevenue,
        };
        return acc;
      },
      {
        VIP: { count: 0, totalRevenue: '0' },
        sadik: { count: 0, totalRevenue: '0' },
        yeni: { count: 0, totalRevenue: '0' },
        riskAlti: { count: 0, totalRevenue: '0' },
      },
    );
  }

  async exportCsv(organizationId: string): Promise<string> {
    const rows = await this.prisma.customer.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: [{ lastOrderAt: 'desc' }, { name: 'asc' }],
    });

    const csvRows = rows.map((c) => ({
      id: c.id,
      ad: c.name,
      eposta: c.email ?? '',
      telefon: c.phone ?? '',
      sehir: c.city ?? '',
      ulke: c.country,
      platform: c.platform ?? '',
      toplam_siparis: c.totalOrders,
      toplam_harcama: c.totalSpent.toString(),
      ilk_siparis: c.firstOrderAt?.toISOString() ?? '',
      son_siparis: c.lastOrderAt?.toISOString() ?? '',
      etiketler: c.tags.join('|'),
      segmentler: computeCustomerSegments(c).join('|'),
    }));

    return `\uFEFF${Papa.unparse(csvRows)}`;
  }

  async addTag(
    organizationId: string,
    id: string,
    tag: string,
  ): Promise<SerializedCustomer> {
    const customer = await this.requireCustomer(organizationId, id);
    const normalized = tag.trim();
    if (normalized.length === 0 || customer.tags.includes(normalized)) {
      return serializeCustomer(customer);
    }
    const updated = await this.prisma.customer.update({
      where: { id: customer.id },
      data: { tags: { push: normalized } },
    });
    return serializeCustomer(updated);
  }

  async removeTag(
    organizationId: string,
    id: string,
    tag: string,
  ): Promise<SerializedCustomer> {
    const customer = await this.requireCustomer(organizationId, id);
    const normalized = tag.trim();
    const updated = await this.prisma.customer.update({
      where: { id: customer.id },
      data: {
        tags: customer.tags.filter((t) => t !== normalized),
      },
    });
    return serializeCustomer(updated);
  }

  async addNote(
    organizationId: string,
    id: string,
    note: string,
  ): Promise<SerializedCustomer> {
    const customer = await this.requireCustomer(organizationId, id);
    const stamp = new Date().toLocaleString('tr-TR');
    const entry = `[${stamp}] ${note.trim()}`;
    const nextNotes = customer.notes
      ? `${customer.notes}\n${entry}`
      : entry;

    const updated = await this.prisma.customer.update({
      where: { id: customer.id },
      data: { notes: nextNotes },
    });
    return serializeCustomer(updated);
  }

  private async requireCustomer(
    organizationId: string,
    id: string,
  ): Promise<Customer> {
    const customer = await this.prisma.customer.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!customer) {
      throw new NotFoundException('Müşteri bulunamadı');
    }
    return customer;
  }
}
