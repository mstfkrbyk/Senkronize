import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';

import { AuditContextInterceptor } from './audit-context.interceptor';
import { AuditService } from './audit.service';
import { PrismaAuditSetupService } from './prisma-audit-setup.service';

@Module({
  imports: [PrismaModule],
  providers: [AuditService, PrismaAuditSetupService, AuditContextInterceptor],
  exports: [AuditService, AuditContextInterceptor],
})
export class AuditModule {}
