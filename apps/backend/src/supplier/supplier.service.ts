import { Injectable, NotFoundException } from '@nestjs/common';
import {
  POStatus,
  Prisma,
  type PurchaseOrder,
  type Supplier,
  type SupplierContact,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import type {
  CreateSupplierContactDto,
  CreateSupplierDto,
  SupplierQueryDto,
  UpdateSupplierDto,
} from './supplier.dto';

export interface SupplierListRow extends Supplier {
  orderCount: number;
  totalSpend: string;
}

export interface SupplierPerformance {
  avgDeliveryDays: number | null;
  orderCount: number;
  totalSpend: string;
  rating: number | null;
  orderHistory: PurchaseOrder[];
}

@Injectable()
export class SupplierService {
  constructor(private readonly prisma: PrismaService) {}

  private mapCreateData(
    organizationId: string,
    dto: CreateSupplierDto,
  ): Prisma.SupplierCreateInput {
    return {
      organization: { connect: { id: organizationId } },
      name: dto.name.trim(),
      contactName: dto.contactPerson?.trim() || null,
      email: dto.email?.trim().toLowerCase() || null,
      phone: dto.phone?.trim() || null,
      address: dto.address?.trim() || null,
      country: dto.country?.trim() || null,
      taxNumber: dto.taxId?.trim() || null,
      paymentTerms: dto.paymentTerms?.trim() || null,
      currency: (dto.currency ?? 'TRY').trim().toUpperCase().slice(0, 8),
      leadTimeDays: dto.leadTimeDays ?? null,
      notes: dto.notes?.trim() || null,
      isActive: dto.isActive ?? true,
    };
  }

  private mapUpdateData(dto: UpdateSupplierDto): Prisma.SupplierUpdateInput {
    return {
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.contactPerson !== undefined
        ? { contactName: dto.contactPerson?.trim() || null }
        : {}),
      ...(dto.email !== undefined ? { email: dto.email?.trim().toLowerCase() || null } : {}),
      ...(dto.phone !== undefined ? { phone: dto.phone?.trim() || null } : {}),
      ...(dto.address !== undefined ? { address: dto.address?.trim() || null } : {}),
      ...(dto.country !== undefined ? { country: dto.country?.trim() || null } : {}),
      ...(dto.taxId !== undefined ? { taxNumber: dto.taxId?.trim() || null } : {}),
      ...(dto.paymentTerms !== undefined
        ? { paymentTerms: dto.paymentTerms?.trim() || null }
        : {}),
      ...(dto.currency !== undefined
        ? { currency: dto.currency.trim().toUpperCase().slice(0, 8) }
        : {}),
      ...(dto.leadTimeDays !== undefined ? { leadTimeDays: dto.leadTimeDays } : {}),
      ...(dto.notes !== undefined ? { notes: dto.notes?.trim() || null } : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
    };
  }

  async create(organizationId: string, dto: CreateSupplierDto): Promise<Supplier> {
    return this.prisma.supplier.create({
      data: this.mapCreateData(organizationId, dto),
    });
  }

  async findAll(
    organizationId: string,
    query: SupplierQueryDto,
  ): Promise<{ data: SupplierListRow[]; total: number; page: number; limit: number }> {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const skip = (page - 1) * limit;
    const search = query.search?.trim();
    const country = query.country?.trim();

    const where: Prisma.SupplierWhereInput = {
      organizationId,
      deletedAt: null,
      ...(country && country.length > 0 ? { country: { equals: country, mode: 'insensitive' } } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(search && search.length > 0
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { contactName: { contains: search, mode: 'insensitive' } },
              { country: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.supplier.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.supplier.count({ where }),
    ]);

    const data: SupplierListRow[] = await Promise.all(
      rows.map(async (s) => {
        const agg = await this.prisma.purchaseOrder.aggregate({
          where: {
            organizationId,
            supplierId: s.id,
            status: { not: POStatus.CANCELLED },
          },
          _count: { id: true },
          _sum: { totalAmount: true },
        });
        return {
          ...s,
          orderCount: agg._count.id,
          totalSpend: (agg._sum.totalAmount ?? new Prisma.Decimal(0)).toFixed(2),
        };
      }),
    );

    return { data, total, page, limit };
  }

  async findOne(organizationId: string, id: string): Promise<Supplier> {
    const row = await this.prisma.supplier.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!row) {
      throw new NotFoundException('Tedarikçi bulunamadı.');
    }
    return row;
  }

  async update(
    organizationId: string,
    id: string,
    dto: UpdateSupplierDto,
  ): Promise<Supplier> {
    await this.findOne(organizationId, id);
    return this.prisma.supplier.update({
      where: { id },
      data: this.mapUpdateData(dto),
    });
  }

  async remove(organizationId: string, id: string): Promise<void> {
    await this.findOne(organizationId, id);
    await this.prisma.supplier.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  async getPerformance(organizationId: string, supplierId: string): Promise<SupplierPerformance> {
    const supplier = await this.findOne(organizationId, supplierId);

    const orders = await this.prisma.purchaseOrder.findMany({
      where: { organizationId, supplierId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const agg = await this.prisma.purchaseOrder.aggregate({
      where: {
        organizationId,
        supplierId,
        status: { not: POStatus.CANCELLED },
      },
      _count: { id: true },
      _sum: { totalAmount: true },
    });

    const receivedOrders = orders.filter(
      (o) => o.status === POStatus.RECEIVED && o.receivedAt !== null,
    );
    let avgDeliveryDays: number | null = null;
    if (receivedOrders.length > 0) {
      const totalDays = receivedOrders.reduce((sum, o) => {
        const start = o.sentAt ?? o.createdAt;
        const end = o.receivedAt as Date;
        const days = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
        return sum + days;
      }, 0);
      avgDeliveryDays = Math.round((totalDays / receivedOrders.length) * 10) / 10;
    }

    return {
      avgDeliveryDays,
      orderCount: agg._count.id,
      totalSpend: (agg._sum.totalAmount ?? new Prisma.Decimal(0)).toFixed(2),
      rating: supplier.rating ? Number(supplier.rating) : null,
      orderHistory: orders,
    };
  }

  async addContact(
    organizationId: string,
    supplierId: string,
    dto: CreateSupplierContactDto,
  ): Promise<SupplierContact> {
    await this.findOne(organizationId, supplierId);
    return this.prisma.supplierContact.create({
      data: {
        organizationId,
        supplierId,
        subject: dto.subject?.trim() || null,
        notes: dto.notes.trim(),
        contactMethod: dto.contactMethod?.trim() || null,
      },
    });
  }

  /** Tamamlanan siparişlere göre tedarikçi puanını yeniden hesaplar (1–5). */
  async recalculateRating(organizationId: string, supplierId: string): Promise<void> {
    const supplier = await this.findOne(organizationId, supplierId);
    const received = await this.prisma.purchaseOrder.findMany({
      where: {
        organizationId,
        supplierId,
        status: POStatus.RECEIVED,
        receivedAt: { not: null },
      },
      select: {
        expectedDate: true,
        receivedAt: true,
        sentAt: true,
        createdAt: true,
      },
    });

    if (received.length === 0) {
      return;
    }

    const leadTime = supplier.leadTimeDays ?? 7;
    let scoreSum = 0;

    for (const po of received) {
      const start = po.sentAt ?? po.createdAt;
      const end = po.receivedAt as Date;
      const actualDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
      const expected = po.expectedDate
        ? (po.expectedDate.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
        : leadTime;

      const diff = actualDays - expected;
      let score: number;
      if (diff <= 0) {
        score = 5;
      } else if (diff <= 2) {
        score = 4;
      } else if (diff <= 5) {
        score = 3;
      } else if (diff <= 10) {
        score = 2;
      } else {
        score = 1;
      }
      scoreSum += score;
    }

    const avgRating = Math.round((scoreSum / received.length) * 100) / 100;
    await this.prisma.supplier.update({
      where: { id: supplierId },
      data: { rating: new Prisma.Decimal(avgRating) },
    });
  }
}
