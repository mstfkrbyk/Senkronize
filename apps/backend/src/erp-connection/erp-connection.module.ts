import { Module } from '@nestjs/common';

import { ErpModule } from '../erp/erp.module';

import { ErpConnectionController } from './erp-connection.controller';
import { ErpConnectionService } from './erp-connection.service';

@Module({
  imports: [ErpModule],
  controllers: [ErpConnectionController],
  providers: [ErpConnectionService],
  exports: [ErpConnectionService],
})
export class ErpConnectionModule {}
