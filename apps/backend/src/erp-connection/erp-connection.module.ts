import { Module } from '@nestjs/common';

import { ConnectionHealthModule } from '../connection-health/connection-health.module';
import { ErpModule } from '../erp/erp.module';

import { ErpConnectionController } from './erp-connection.controller';
import { ErpConnectionService } from './erp-connection.service';

@Module({
  imports: [ErpModule, ConnectionHealthModule],
  controllers: [ErpConnectionController],
  providers: [ErpConnectionService],
  exports: [ErpConnectionService],
})
export class ErpConnectionModule {}
