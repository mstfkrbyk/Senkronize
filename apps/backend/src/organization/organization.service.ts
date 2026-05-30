import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { getAccountingModeChangeBlockReason } from '../common/accounting-mode';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateOrganizationDto } from './organization.dto';
import { PatchOrganizationSettingsDto } from './organization-settings.dto';
import {
  formatInvoiceNumber,
  type InvoiceNumberingSettings,
  parseOrganizationMetadata,
  resolveDefaultAutoInvoice,
  resolveProductMatchKey,
} from './organization.types';

@Injectable()
export class OrganizationService {
  constructor(private readonly prisma: PrismaService) {}

  async getById(organizationId: string) {
    const org = await this.prisma.organization.findFirst({
      where: { id: organizationId, deletedAt: null },
    });
    if (!org) {
      throw new NotFoundException('Organizasyon bulunamadı.');
    }
    return org;
  }

  async update(organizationId: string, dto: UpdateOrganizationDto) {
    await this.getById(organizationId);

    if (dto.accountingMode !== undefined) {
      const activeErpCount = await this.prisma.erpConnection.count({
        where: { organizationId, deletedAt: null, isActive: true },
      });
      const blockReason = getAccountingModeChangeBlockReason(
        dto.accountingMode,
        activeErpCount,
      );
      if (blockReason) {
        throw new ConflictException(blockReason);
      }
    }

    return this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.logoUrl !== undefined ? { logoUrl: dto.logoUrl } : {}),
        ...(dto.onboardingCompleted !== undefined
          ? { onboardingCompleted: dto.onboardingCompleted }
          : {}),
        ...(dto.accountingMode !== undefined
          ? { accountingMode: dto.accountingMode }
          : {}),
        ...(dto.defaultCurrency !== undefined
          ? { defaultCurrency: dto.defaultCurrency }
          : {}),
        ...(dto.currencyPreferManualRates !== undefined
          ? { currencyPreferManualRates: dto.currencyPreferManualRates }
          : {}),
        ...(dto.currencyTcmbEnabled !== undefined
          ? { currencyTcmbEnabled: dto.currencyTcmbEnabled }
          : {}),
        ...(dto.currencyManualRates !== undefined
          ? {
              currencyManualRates: dto.currencyManualRates as Prisma.InputJsonValue,
            }
          : {}),
        ...(dto.taxNumber !== undefined ? { taxNumber: dto.taxNumber.trim() || null } : {}),
        ...(dto.taxOffice !== undefined ? { taxOffice: dto.taxOffice.trim() || null } : {}),
        ...(dto.address !== undefined ? { address: dto.address.trim() || null } : {}),
        ...(dto.city !== undefined ? { city: dto.city.trim() || null } : {}),
        ...(dto.require2FA !== undefined ? { require2FA: dto.require2FA } : {}),
        ...(dto.passwordMinLength !== undefined
          ? { passwordMinLength: dto.passwordMinLength }
          : {}),
        ...(dto.passwordRequireSpecial !== undefined
          ? { passwordRequireSpecial: dto.passwordRequireSpecial }
          : {}),
        ...(dto.passwordRequireNumber !== undefined
          ? { passwordRequireNumber: dto.passwordRequireNumber }
          : {}),
        ...(dto.passwordMaxAgeDays !== undefined
          ? { passwordMaxAgeDays: dto.passwordMaxAgeDays }
          : {}),
      },
    });
  }

  async getSettings(organizationId: string): Promise<InvoiceNumberingSettings> {
    const org = await this.getById(organizationId);
    return this.resolveInvoiceNumberingSettings(organizationId, org.metadata);
  }

  async updateSettings(
    organizationId: string,
    dto: PatchOrganizationSettingsDto,
  ): Promise<InvoiceNumberingSettings> {
    const org = await this.getById(organizationId);
    const meta = parseOrganizationMetadata(org.metadata);

    if (dto.invoiceNumberPrefix !== undefined) {
      meta.invoiceNumberPrefix = dto.invoiceNumberPrefix.trim();
    }
    if (dto.nextSequence !== undefined) {
      meta.nextSequence = dto.nextSequence;
      meta.invoiceNumberYear = new Date().getFullYear();
    }
    if (dto.defaultAutoInvoice !== undefined) {
      meta.defaultAutoInvoice = dto.defaultAutoInvoice;
    }
    if (dto.productMatchKey !== undefined) {
      meta.productMatchKey = dto.productMatchKey;
    }

    await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        metadata: meta as Prisma.InputJsonValue,
      },
    });

    return this.resolveInvoiceNumberingSettings(organizationId, meta);
  }

  async reserveInvoiceNumber(organizationId: string): Promise<string> {
    return this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.findFirst({
        where: { id: organizationId, deletedAt: null },
      });
      if (!org) {
        throw new NotFoundException('Organizasyon bulunamadı.');
      }

      const year = new Date().getFullYear();
      const meta = parseOrganizationMetadata(org.metadata);
      const storedYear = meta.invoiceNumberYear ?? year;
      let sequence =
        storedYear === year && typeof meta.nextSequence === 'number' && meta.nextSequence >= 1
          ? meta.nextSequence
          : await this.countInvoicesForYear(tx, organizationId, year);

      const prefix = (meta.invoiceNumberPrefix ?? '').trim();
      const invoiceNumber = formatInvoiceNumber(prefix, year, sequence);

      await tx.organization.update({
        where: { id: organizationId },
        data: {
          metadata: {
            ...meta,
            invoiceNumberPrefix: meta.invoiceNumberPrefix ?? '',
            invoiceNumberYear: year,
            nextSequence: sequence + 1,
          } as Prisma.InputJsonValue,
        },
      });

      return invoiceNumber;
    });
  }

  private async resolveInvoiceNumberingSettings(
    organizationId: string,
    rawMetadata: unknown,
  ): Promise<InvoiceNumberingSettings> {
    const meta = parseOrganizationMetadata(rawMetadata);
    const year = new Date().getFullYear();
    const prefix = (meta.invoiceNumberPrefix ?? '').trim();
    const storedYear = meta.invoiceNumberYear ?? year;

    let nextSequence: number;
    if (
      storedYear === year &&
      typeof meta.nextSequence === 'number' &&
      meta.nextSequence >= 1
    ) {
      nextSequence = meta.nextSequence;
    } else {
      nextSequence = await this.countInvoicesForYear(this.prisma, organizationId, year);
    }

    return {
      invoiceNumberPrefix: prefix,
      nextSequence,
      defaultAutoInvoice: resolveDefaultAutoInvoice(meta),
      productMatchKey: resolveProductMatchKey(meta),
    };
  }

  private async countInvoicesForYear(
    db: Pick<PrismaService, 'invoice'>,
    organizationId: string,
    year: number,
  ): Promise<number> {
    const count = await db.invoice.count({
      where: { organizationId, invoiceYear: year, deletedAt: null },
    });
    return count + 1;
  }
}
