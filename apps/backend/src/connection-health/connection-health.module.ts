import { Module } from '@nestjs/common';

import { AdaptersCommonModule } from '../adapters/common/adapters-common.module';
import { ErpModule } from '../erp/erp.module';
import { PrismaModule } from '../prisma/prisma.module';

import { ConnectionHealthService } from './connection-health.service';

@Module({
  imports: [PrismaModule, AdaptersCommonModule, ErpModule],
  providers: [ConnectionHealthService],
  exports: [ConnectionHealthService],
})
export class ConnectionHealthModule {}
