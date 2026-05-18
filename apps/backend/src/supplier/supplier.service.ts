import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type Supplier } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import type { CreateSupplierDto, SupplierQueryDto, UpdateSupplierDto } from './supplier.dto';

export interface SupplierListRow extends Supplier {
  orderCount: number;
  totalSpend: string;
}

export interface SupplierStats {
  orderCount: number;
  totalSpend: string;
}

@Injectable()
export class SupplierService {
  constructor(private readonly prisma: PrismaService) {}

  async create(organizationId: string, dto: CreateSupplierDto): Promise<Supplier> {
    return this.prisma.supplier.create({
      data: {
        organizationId,
        name: dto.name.trim(),
        contactName: dto.contactName?.trim() || null,
        email: dto.email?.trim().toLowerCase() || null,
        phone: dto.phone?.trim() || null,
        address: dto.address?.trim() || null,
        taxNumber: dto.taxNumber?.trim() || null,
        notes: dto.notes?.trim() || null,
        isActive: dto.isActive ?? true,
      },
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

    const where: Prisma.SupplierWhereInput = {
      organizationId,
      deletedAt: null,
      ...(search && search.length > 0
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { contactName: { contains: search, mode: 'insensitive' } },
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
            status: { not: 'CANCELLED' },
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
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.contactName !== undefined
          ? { contactName: dto.contactName?.trim() || null }
          : {}),
        ...(dto.email !== undefined ? { email: dto.email?.trim().toLowerCase() || null } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone?.trim() || null } : {}),
        ...(dto.address !== undefined ? { address: dto.address?.trim() || null } : {}),
        ...(dto.taxNumber !== undefined ? { taxNumber: dto.taxNumber?.trim() || null } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes?.trim() || null } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  async remove(organizationId: string, id: string): Promise<void> {
    await this.findOne(organizationId, id);
    await this.prisma.supplier.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  async getSupplierStats(organizationId: string, supplierId: string): Promise<SupplierStats> {
    await this.findOne(organizationId, supplierId);
    const agg = await this.prisma.purchaseOrder.aggregate({
      where: {
        organizationId,
        supplierId,
        status: { not: 'CANCELLED' },
      },
      _count: { id: true },
      _sum: { totalAmount: true },
    });
    const total = agg._sum.totalAmount ?? new Prisma.Decimal(0);
    return {
      orderCount: agg._count.id,
      totalSpend: total.toFixed(2),
    };
  }
}
