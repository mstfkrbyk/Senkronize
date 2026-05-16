import { Module } from '@nestjs/common';

import { ErpConnectionController } from './erp-connection.controller';
import { ErpConnectionService } from './erp-connection.service';

@Module({
  controllers: [ErpConnectionController],
  providers: [ErpConnectionService],
  exports: [ErpConnectionService],
})
export class ErpConnectionModule {}
