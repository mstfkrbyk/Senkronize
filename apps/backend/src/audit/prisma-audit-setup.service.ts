import { Injectable, OnModuleInit } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

import { AuditService } from './audit.service';

@Injectable()
export class PrismaAuditSetupService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  onModuleInit(): void {
    this.auditService.registerPrismaMiddleware(this.prisma);
  }
}
