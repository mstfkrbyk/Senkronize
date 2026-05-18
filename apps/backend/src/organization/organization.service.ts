import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { UpdateOrganizationDto } from './organization.dto';

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
    return this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.logoUrl !== undefined ? { logoUrl: dto.logoUrl } : {}),
        ...(dto.onboardingCompleted !== undefined
          ? { onboardingCompleted: dto.onboardingCompleted }
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
      },
    });
  }
}
