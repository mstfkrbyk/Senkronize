import { Module } from '@nestjs/common';

import { ConnectionHealthModule } from '../connection-health/connection-health.module';
import { PrismaModule } from '../prisma/prisma.module';

import { ConnectionsController } from './connections.controller';
import { ConnectionsService } from './connections.service';

@Module({
  imports: [PrismaModule, ConnectionHealthModule],
  controllers: [ConnectionsController],
  providers: [ConnectionsService],
  exports: [ConnectionsService],
})
export class ConnectionsModule {}
